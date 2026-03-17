const { FieldValue } = require("firebase-admin/firestore");
const { parseDate, formatFirestoreDate, sanitizeForCsv, commitIfFull } = require("../middleware/utils.js");

/**
 * Validates that the input data only contains the allowed keys.
 * If any extra keys are found, it throws an error.
 */
const ALLOWED_CSV_FIELDS = [
  "name", "company_id", "street_and_number", "zip_code", "township",
  "contact_person_first_name", "contact_person_last_name", 
  "contact_person_email", "contact_person_phone_number",
  "membership_origin_date", "membership_extinction_date", "id"
];

const importCollectives = async (req, res, db) => {
  try {
    const { data: records } = req.body;
    const userEmail = req.user.email;
    const dbNow = FieldValue.serverTimestamp();

    if (!Array.isArray(records)) {
      return res.status(400).send({ error: "Invalid data format." });
    }

    // Identify which records are updates (have IDs)
    const updateIds = records
      .map(r => r.id)
      .filter(id => id && id.trim() !== "");

    // Validate that these IDs actually exist in Firestore
    let existingIds = new Set();
    if (updateIds.length > 0) {
      const docRefs = updateIds.map(id => db.collection("collective_members").doc(id));
      const snapshots = await db.getAll(...docRefs);
      
      const missingIds = [];
      snapshots.forEach(snap => {
        if (snap.exists) {
          existingIds.add(snap.id);
        } else {
          missingIds.push(snap.id);
        }
      });

      if (missingIds.length > 0) {
        return res.status(400).send({ 
          error: `Import rejected. The following IDs do not exist in the database: [${missingIds.join(', ')}]` 
        });
      }
    }

    let batch = db.batch();
    let opCount = 0;

    for (const row of records) {
      // Header check
      const invalidKeys = Object.keys(row).filter(k => k !== "__parsed_extra" && !ALLOWED_CSV_FIELDS.includes(k));
      if (invalidKeys.length > 0) {
        return res.status(400).send({ error: `Unauthorized columns: [${invalidKeys.join(', ')}]` });
      }

      const isUpdate = row.id && row.id.trim() !== "";
      const docRef = isUpdate 
        ? db.collection("collective_members").doc(row.id) 
        : db.collection("collective_members").doc();

      // Data structure
      const formattedData = {
        name: row.name || null,
        company_id: row.company_id || null,
        address: {
          street_and_number: row.street_and_number || null,
          zip_code: row.zip_code || null,
          township: row.township || null
        },
        contact_person: {
          first_name: row.contact_person_first_name || null,
          last_name: row.contact_person_last_name || null,
          email: row.contact_person_email || null,
          phone_number: row.contact_person_phone_number || null
        },
        membership_origin_date: parseDate(row.membership_origin_date),
        membership_extinction_date: parseDate(row.membership_extinction_date),
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
    res.status(200).send({ message: `Successfully processed ${records.length} records.` });

  } catch (error) {
    console.error("IMPORT_COLLECTIVES_ERROR:", error);
    res.status(500).send({ error: error.message });
  }
};

const exportCollectives = async (req, res, db) => {
  try {
    // Fetch all collectives
    const snapshot = await db.collection("collective_members").get();

    const headers = [
      "name", "company_id", "street_and_number", "zip_code", "township",
      "contact_person_first_name", "contact_person_last_name", 
      "contact_person_email", "contact_person_phone_number",
      "membership_origin_date", "membership_extinction_date", "id"
    ];

    // Filter for acttive only and Map to rows
    const rows = snapshot.docs
      .filter(doc => {
        const data = doc.data();
        // Active = field doesn't exist OR field is null
        return !data.membership_extinction_date;
      })
      .map(doc => {
        const data = doc.data();
        const values = [
          data.name,
          data.company_id,
          data.address?.street_and_number,
          data.address?.zip_code,
          data.address?.township,
          data.contact_person?.first_name,
          data.contact_person?.last_name,
          data.contact_person?.email,
          data.contact_person?.phone_number,
          formatFirestoreDate(data.membership_origin_date),
          formatFirestoreDate(data.membership_extinction_date),
          doc.id
        ];
        return values.map(v => `"${sanitizeForCsv(v)}"`).join(",");
      });

    const csvContent = [headers.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=active_collectives.csv");
    return res.status(200).send(csvContent);

  } catch (error) {
    console.error("EXPORT_COLLECTIVE_ERROR:", error);
    res.status(500).send({ error: "Failed to export collectives." });
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

const terminateCollective = async (req, res, db) => {
  try {
    const { collectiveId, terminationDate } = req.body;
    const userEmail = req.user.email;
    const dbNow = FieldValue.serverTimestamp();
    const jsNow = new Date();

    if (!collectiveId) return res.status(400).send({ error: "Missing collectiveId." });

    // Validate Source Collective
    const collectiveRef = db.collection("collective_members").doc(collectiveId);
    const collectiveDoc = await collectiveRef.get();

    if (!collectiveDoc.exists) return res.status(404).send({ error: "Collective not found." });
    if (collectiveDoc.data().membership_extinction_date) {
      return res.status(400).send({ error: "Club is already terminated." });
    }

    //Validate Termination Date (if provided)
    let parsedTerminationDate = null;
    if (terminationDate) {
      parsedTerminationDate = parseDate(terminationDate);
      if (!parsedTerminationDate) {
        return res.status(400).send({ error: "Invalid termination date format." });
      }
         if (parsedTerminationDate.toDate() > jsNow) {
        return res.status(400).send({ error: "Termination date cannot be in the future." });
      }
    }

    let batch = db.batch();
    let operationCount = 0;

    // Terminate the Club
    batch.update(collectiveRef, {
      membership_extinction_date: parsedTerminationDate || dbNow,
      modifiedAt: dbNow,
      modifiedBy: userEmail
    });
    operationCount++;

    // Terminate all Athletes associated
    const athletes = await db.collection("registered_members")
      .where("collective_member_ref", "==", collectiveId)
      .get();

    for (const doc of athletes.docs) {
      batch = await commitIfFull(batch, operationCount, db);
      batch.update(doc.ref, {
        membership_extinction_date: parsedTerminationDate || dbNow,
        modifiedAt: dbNow,
        modifiedBy: userEmail
      });
      operationCount++;
    }

    await batch.commit();
    res.status(200).send({ message: `Club ${collectiveId} and ${athletes.size} members terminated.` });

  } catch (error) {
    console.error("TERMINATE_COLLECTIVE_ERROR:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
};

const deleteCollective = async (req, res, db) => {
  try {
    const { collectiveId } = req.body;

    if (!collectiveId) {
      return res.status(400).send({ error: "Missing collectiveId." });
    }

    // Fetch the document to check existence and status
    const collectiveRef = db.collection("collective_members").doc(collectiveId);
    const collectiveSnap = await collectiveRef.get();

    if (!collectiveSnap.exists) {
      return res.status(404).send({ error: "Collective member not found." });
    }

    const data = collectiveSnap.data();

    // Constraint: Only delete if already terminated
    if (!data.membership_extinction_date) {
      return res.status(400).send({ 
        error: "Cannot delete an active member. You must terminate the membership first." 
      });
    }

    // Prepare for Cascade Deletion
    const athletesSnap = await db.collection("registered_members")
      .where("collective_member_ref", "==", collectiveId)
      .get();

    let batch = db.batch();
    let opCount = 0;

    // Add athletes to the deletion batch
    for (const doc of athletesSnap.docs) {
      batch = await commitIfFull(batch, opCount, db);
      batch.delete(doc.ref);
      opCount++;
    }

    // Add the collective itself to the batch
    batch = await commitIfFull(batch, opCount, db);
    batch.delete(collectiveRef);

    // Execute
    await batch.commit();

    return res.status(200).send({ 
      message: `Successfully deleted collective ${collectiveId} and ${athletesSnap.size} associated members.` 
    });

  } catch (error) {
    console.error("DELETE_COLLECTIVE_ERROR:", error);
    return res.status(500).send({ error: "Internal Server Error during deletion." });
  }
};

module.exports = { importCollectives, exportCollectives, transferRegisteredMembers, terminateCollective, deleteCollective};