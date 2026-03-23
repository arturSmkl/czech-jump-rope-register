const { FieldValue } = require("firebase-admin/firestore");
const { parseDate, formatFirestoreDate, formatNSADate, commitIfFull, sanitizeForCsv } = require("../middleware/utils.js");

const ALLOWED_CSV_FIELDS = [
  "first_name", "last_name", "birth_number", "sex", "date_of_birth",
  "street", "house_number", "zip_code", "township", "country",
  "nationality_code", "membership_origin_date", "membership_extinction_date",
  "medical_examination_validity", "competitions_last_12_months",
  "athlete", "referee", "coach", "id"
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
        nationality_code: row.nationality_code || null,
        address: {
          street: row.street || null,
          house_number: row.house_number || null,
          zip_code: row.zip_code || null,
          township: row.township || null,
          country: row.country || null
        },
        membership_origin_date: originDate,
        membership_extinction_date: finalExtinctionDate,
        medical_examination_validity: medicalDate,
        competitions_last_12_months: parseInt(row.competitions_last_12_months, 10) || 0,
        athlete: row.athlete === "ano",
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

    // Filter for active athletes and format rows
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
          data.address?.country,
          formatFirestoreDate(data.membership_origin_date),
          formatFirestoreDate(data.membership_extinction_date),
          formatFirestoreDate(data.medical_examination_validity),
          data.competitions_last_12_months || 0,
          data.referee ? "ano" : "ne",
          data.coach ? "ano" : "ne",
          doc.id
        ];
        return values.map(v => `"${sanitizeForCsv(v)}"`).join(";");
      });

    // Generate CSV Content
    const csvContent = [ALLOWED_CSV_FIELDS.join(";"), ...rows].join("\n");

    // Set Headers for download
    const safeClubName = collectiveData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dateStr = formatFirestoreDate({ toDate: () => new Date() });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader("Content-Disposition", `attachment; filename=active_members_${safeClubName}_${dateStr}.csv`);
    
    return res.status(200).send(csvContent);

  } catch (error) {
    console.error("EXPORT_REGISTERED_ERROR:", error);
    res.status(500).send({ error: "An internal error occurred during the export process." });
  }
};

const exportRegisteredNsa = async (req, res, db) => {
  try {
    // Fetch ALL collectives first to create a lookup table for company_id (IČO)
    const collectivesSnap = await db.collection("collective_members").get();
    const clubLookup = new Map();
    
    collectivesSnap.forEach(doc => {
      clubLookup.set(doc.id, doc.data().company_id || "");
    });

    // Fetch ALL registered members
    const membersSnap = await db.collection("registered_members").get();

    // Define the 32 NSA Headers
    const headers = [
      "[JMENO]", "[PRIJMENI]", "[TITUL_PRED]", "[TITUL_ZA]", "[RODNE_CISLO]",
      "[OBCANSTVI]", "[DATUM_NAROZENI]", "[POHLAVI]", "[NAZEV_OBCE]",
      "[NAZEV_CASTI_OBCE]", "[NAZEV_ULICE]", "[CISLO_POPISNE]", "[CISLO_ORIENTACNI]",
      "[PSC]", "[SPORTOVEC]", "[SPORTOVCEM_OD]", "[SPORTOVCEM_DO]",
      "[SPORTOVEC_CETNOST]", "[SPORTOVEC_DRUH_SPORTU]", "[SPORTOVEC_CINNOST_OD]",
      "[SPORTOVEC_CINNOST_DO]", "[SPORTOVEC_UCAST_SOUTEZE_POCET]", "[TRENER]",
      "[TRENEREM_OD]", "[TRENEREM_DO]", "[TRENER_CETNOST]", "[TRENER_DRUH_SPORTU]",
      "[TRENER_CINNOST_OD]", "[TRENER_CINNOST_DO]", "[EXT_ID]", "[SVAZ_ICO_SKTJ]", "[STAV]"
    ];

    // Filter and Process Rows
    const rows = membersSnap.docs
      .map(doc => doc.data())
      // Filter: Skip if neither athlete nor coach is true
      .filter(m => m.athlete === true || m.coach === true)
      .map(m => {
        const isCze = m.nationality_code === "CZE";
        const isAthlete = m.athlete === true;
        const isCoach = m.coach === true;
        
        // Get the IČO from our pre-fetched Map using the reference
        const clubIco = clubLookup.get(m.collective_member_ref) || "";

        // Map fields based on your instructions
        const rowData = [
          m.first_name,                                      // [JMENO]
          m.last_name,                                       // [PRIJMENI]
          "",                                                // [TITUL_PRED]
          "",                                                // [TITUL_ZA]
          isCze ? m.birth_number : "",                       // [RODNE_CISLO]
          m.nationality_code,                                // [OBCANSTVI]
          !isCze ? formatNSADate(m.date_of_birth) : "",      // [DATUM_NAROZENI]
          m.sex,                                             // [POHLAVI]
          !isCze ? (m.address?.township || "") : "",         // [NAZEV_OBCE]
          "",                                                // [NAZEV_CASTI_OBCE]
          "",                                                // [NAZEV_ULICE]
          !isCze ? (m.address?.house_number || "") : "",     // [CISLO_POPISNE]
          "",                                                // [CISLO_ORIENTACNI]
          !isCze ? (m.address?.zip_code || "") : "",         // [PSC]
          isAthlete ? "1" : "0",                              // [SPORTOVEC]
          isAthlete ? formatNSADate(m.membership_origin_date) : "", // [SPORTOVCEM_OD]
          isAthlete ? formatNSADate(m.membership_extinction_date) : "", // [SPORTOVCEM_DO]
          "",                                                // [SPORTOVEC_CETNOST]
          isAthlete ? "308.1" : "",                          // [SPORTOVEC_DRUH_SPORTU]
          isAthlete ? formatNSADate(m.membership_origin_date) : "", // [SPORTOVEC_CINNOST_OD]
          isAthlete ? formatNSADate(m.membership_extinction_date) : "", // [SPORTOVEC_CINNOST_DO]
          isAthlete ? (m.competitions_last_12_months || 0) : "", // [SPORTOVEC_UCAST_SOUTEZE_POCET]
          isCoach ? "1" : "0",                               // [TRENER]
          isCoach ? formatNSADate(m.membership_origin_date) : "", // [TRENEREM_OD]
          isCoach ? formatNSADate(m.membership_extinction_date) : "", // [TRENEREM_DO]
          "",                                                // [TRENER_CETNOST]
          isCoach ? "308.1" : "",                            // [TRENER_DRUH_SPORTU]
          isCoach ? formatNSADate(m.membership_origin_date) : "", // [TRENER_CINNOST_OD]
          isCoach ? formatNSADate(m.membership_extinction_date) : "", // [TRENER_CINNOST_DO]
          "",                                                // [EXT_ID]
          clubIco,                                           // [SVAZ_ICO_SKTJ]
          ""                                                 // [STAV]
        ];

        // Sanitize and join with semicolons
        return rowData.map(val => {
          let s = String(val ?? "").replace(/;/g, ' '); 
          return `"${s}"`;
        }).join(";");
      });

    // Build CSV with UTF-8 BOM (Byte Order Mark)
    // The BOM helps Excel/NSA systems recognize Czech characters like ř, ž, š immediately.
    const BOM = "\uFEFF";
    const csvContent = BOM + [headers.join(";"), ...rows].join("\n");

    const dateStr = formatNSADate({ toDate: () => new Date() }).replace(/\./g, '-');
    
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=NSA_export_${dateStr}.csv`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    return res.status(200).send(csvContent);

  } catch (error) {
    console.error("GLOBAL_NSA_EXPORT_ERROR:", error);
    res.status(500).send({ error: "Failed to generate global NSA export." });
  }
};

const transferRegisteredMembers = async (req, res, db) => {
  try {
    const { collectiveId, action, targetCollectiveId } = req.body;
    const userEmail = req.user.email;
    const now = FieldValue.serverTimestamp();

    // Argument Validation
    const validActions = ["nullify", "nullify_and_terminate", "transfer"];
    if (!collectiveId || !validActions.includes(action)) {
      return res.status(400).send({ error: "Invalid arguments." });
    }
    if (action === "transfer" && !targetCollectiveId) {
      return res.status(400).send({ error: "Target ID required for transfer." });
    }

    // Check if Target Club is active (if transferring)
    let targetIsTerminated = false;
    if (action === "transfer") {
      const targetSnap = await db.collection("collective_members").doc(targetCollectiveId).get();
      if (!targetSnap.exists) return res.status(404).send({ error: "Target Club not found." });
      if (targetSnap.data().membership_extinction_date) {
        targetIsTerminated = true;
      }
    }

    // Get all athletes
    const athletes = await db.collection("registered_members")
      .where("collective_member_ref", "==", collectiveId)
      .get();

    if (athletes.empty) return res.status(200).send({ message: "No members to update." });

    let batch = db.batch();
    let operationCount = 0;

    for (const doc of athletes.docs) {
      batch = await commitIfFull(batch, operationCount, db);
      
      let updateData = { modifiedAt: now, modifiedBy: userEmail };

      if (action === "nullify") {
        updateData.collective_member_ref = null;
      } 
      else if (action === "nullify_and_terminate") {
        updateData.collective_member_ref = null;
        updateData.membership_extinction_date = now;
      } 
      else if (action === "transfer") {
        updateData.collective_member_ref = targetCollectiveId;
        if (targetIsTerminated) {
          updateData.membership_extinction_date = now;
        }
      }

      batch.update(doc.ref, updateData);
      operationCount++;
    }

    await batch.commit();
    res.status(200).send({ message: `Processed ${athletes.size} members via ${action}.` });

  } catch (error) {
    console.error("TRANSFER_MEMBERS_ERROR:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
};

module.exports = { importRegistered, exportRegistered, exportRegisteredNsa, transferRegisteredMembers };