const { FieldValue } = require("firebase-admin/firestore");
const { parseDate, formatFirestoreDate, commitIfFull, sanitizeForCsv } = require("../middleware/utils.js");

const ALLOWED_CSV_FIELDS = [
  "first_name", "last_name", "birth_number", "sex",
  "date_of_birth", "street_and_number", "zip_code", "township",
  "membership_origin_date", "membership_extinction_date",
  "medical_examination_validity", "competitions_last_12_months",
  "referee", "coach", "id"
];

const importRegistered = async (req, res, db) => {
  try {
    const { data: records, collective_member_ref } = req.body;
    const userEmail = req.user.email;
    const dbNow = FieldValue.serverTimestamp();
    const jsNow = new Date();

    if (!Array.isArray(records)) {
      return res.status(400).send({ error: "Invalid data format." });
    }

    // Validate Collective Member Reference & Check Termination Status
    let isParentTerminated = false;
    if (collective_member_ref) {
      const collSnap = await db.collection("collective_members").doc(collective_member_ref).get();
      if (!collSnap.exists) {
        return res.status(400).send({ error: "The referenced Club does not exist." });
      }
      if (collSnap.data().membership_extinction_date) {
        isParentTerminated = true;
      }
    }

    // Pre-validate IDs for Upsert 
    const updateIds = records.map(r => r.id).filter(id => id && id.trim() !== "");
    if (updateIds.length > 0) {
      const docRefs = updateIds.map(id => db.collection("registered_members").doc(id));
      const snapshots = await db.getAll(...docRefs);
      const missingIds = snapshots.filter(s => !s.exists).map(s => s.id);

      if (missingIds.length > 0) {
        return res.status(400).send({ error: `IDs not found: [${missingIds.join(', ')}]` });
      }
    }

    let batch = db.batch();
    let opCount = 0;

    for (const row of records) {
      // Header strictness check
      const invalidKeys = Object.keys(row).filter(k => k !== "__parsed_extra" && !ALLOWED_CSV_FIELDS.includes(k));
      if (invalidKeys.length > 0) {
        return res.status(400).send({ error: `Unauthorized columns: [${invalidKeys.join(', ')}]` });
      }

      // Parse all dates
      const dob = parseDate(row.date_of_birth);
      const originDate = parseDate(row.membership_origin_date);
      const extinctionDate = parseDate(row.membership_extinction_date);
      const medicalDate = parseDate(row.medical_examination_validity);

      const datesToValidate = [
        { name: "date_of_birth", val: dob },
        { name: "membership_origin_date", val: originDate },
        { name: "membership_extinction_date", val: extinctionDate }
      ];

      for (const dateObj of datesToValidate) {
        if (dateObj.val && dateObj.val.toDate() > jsNow) {
          return res.status(400).send({
            error: `Date Error: ${dateObj.name} for ${row.first_name} ${row.last_name} cannot be in the future.` 
          });
        }
      }

      // Auto-termination if Club is terminated 
      // If the parent club is dead, and the row doesn't already have an extinction date, set it to now.
      let finalExtinctionDate = extinctionDate;
      if (isParentTerminated && !finalExtinctionDate) {
        finalExtinctionDate = dbNow;
      }

      const isUpdate = row.id && row.id.trim() !== "";
      const docRef = isUpdate 
        ? db.collection("registered_members").doc(row.id) 
        : db.collection("registered_members").doc();

      const formattedData = {
        first_name: row.first_name || null,
        last_name: row.last_name || null,
        birth_number: row.birth_number || null,
        sex: row.sex || null,
        date_of_birth: dob,
        address: {
          street_and_number: row.street_and_number || null,
          zip_code: row.zip_code || null,
          township: row.township || null
        },
        membership_origin_date: originDate,
        membership_extinction_date: finalExtinctionDate,
        medical_examination_validity: medicalDate,
        competitions_last_12_months: parseInt(row.competitions_last_12_months, 10) || 0,
        referee: row.referee === "ano",
        coach: row.coach === "ano",
        collective_member_ref: collective_member_ref || null,
        modifiedAt: dbNow,
        modifiedBy: userEmail
      };

      if (isUpdate) {
        batch = await commitIfFull(batch, opCount, db);
        batch.set(docRef, formattedData, { merge: true });
      } else {
        formattedData.createdAt = dbNow;
        formattedData.createdBy = userEmail;
        batch = await commitIfFull(batch, opCount, db);
        batch.set(docRef, formattedData);
      }
      
      opCount++;
    }

    await batch.commit();
    res.status(200).send({ message: `Successfully processed ${records.length} members.` });

  } catch (error) {
    console.error("IMPORT_REGISTERED_ERROR:", error);
    res.status(500).send({ error: error.message });
  }
};

// router.get("/export-registered/:collectiveId", exportRegistered);

const exportRegistered = async (req, res, db) => {
  try {
    const { collectiveId } = req.params;

    if (!collectiveId) {
      return res.status(400).send({ error: "Collective ID is required in the URL path." });
    }

    const collectiveRef = db.collection("collective_members").doc(collectiveId);
    const collectiveSnap = await collectiveRef.get();

    if (!collectiveSnap.exists) {
      return res.status(404).send({ error: `Collective member with ID [${collectiveId}] not found.` });
    }

    const collectiveData = collectiveSnap.data();

    // Fetch athletes belonging to this club
    const snapshot = await db.collection("registered_members")
      .where("collective_member_ref", "==", collectiveId)
      .get();

    const headers = [
      "first_name", "last_name", "birth_number", "sex",
      "date_of_birth", "street_and_number", "zip_code", "township",
      "membership_origin_date", "membership_extinction_date",
      "medical_examination_validity", "competitions_last_12_months",
      "referee", "coach", "id"
    ];

    // Filter for ACTIVE athletes and format rows
    const rows = snapshot.docs
      .filter(doc => !doc.data().membership_extinction_date)
      .map(doc => {
        const data = doc.data();
        const values = [
          data.first_name,
          data.last_name,
          data.birth_number,
          data.sex,
          formatFirestoreDate(data.date_of_birth),
          data.address?.street_and_number,
          data.address?.zip_code,
          data.address?.township,
          formatFirestoreDate(data.membership_origin_date),
          formatFirestoreDate(data.membership_extinction_date),
          formatFirestoreDate(data.medical_examination_validity),
          data.competitions_last_12_months || 0,
          data.referee ? "ano" : "ne",
          data.coach ? "ano" : "ne",
          doc.id
        ];
        return values.map(v => `"${sanitizeForCsv(v)}"`).join(",");
      });

    // Generate CSV Content
    const csvContent = [headers.join(","), ...rows].join("\n");

    // Set Headers for download
    const safeClubName = collectiveData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = formatFirestoreDate({ toDate: () => new Date() });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=active_members_${safeClubName}_${dateStr}.csv`);
    
    return res.status(200).send(csvContent);

  } catch (error) {
    console.error("EXPORT_REGISTERED_ERROR:", error);
    res.status(500).send({ error: "An internal error occurred during the export process." });
  }
};

module.exports = { importRegistered, exportRegistered };