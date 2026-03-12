const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Timestamp, FieldValue } = require("firebase-admin/firestore");
const express = require("express");
const cors = require("cors");
const { onRequest } = require("firebase-functions/v2/https");
const { validateRole } = require("./src/middleware/auth.js");

admin.initializeApp();
const db = admin.firestore();
const app = express();

// change for production to frontend URL
app.use(cors({ origin: "http://localhost:5173" }));

/**
 * POST /terminate-collective-membership
 * Body: { 
 * collectiveId: "ID_OF_CLUB", 
 * action: "nullify" | "transfer", 
 * targetCollectiveId: "NEW_CLUB_ID" (only if action is transfer)
 * }
 */
app.post("/terminate-collective-membership",validateRole(['admin', 'editor']), async (req, res) => {
  try {
    const { collectiveId, action, targetCollectiveId } = req.body;

    // Basic Validation
    if (!collectiveId || !action || (action === "transfer" && !targetCollectiveId)) {
      return res.status(400).send({ error: "Missing required fields." });
    }

    const batch = db.batch(); // We use a batch for atomicity 
    const now = FieldValue.serverTimestamp();
    const userEmail = req.user.email; 

    // "Soft Delete" the Collective Member
    const collectiveRef = db.collection("collective_members").doc(collectiveId);
    batch.update(collectiveRef, {
      membership_extinction_date: now,
      modifiedAt: now,
      modifiedBy: userEmail 
    });

    // Handle Registered Members (Athletes)
    // Find all athletes belonging to this club
    const athletesQuery = await db.collection("registered_members")
      .where("collective_member_ref", "==", collectiveId)
      .get();

    if (!athletesQuery.empty) {
      athletesQuery.forEach((doc) => {
        const athleteRef = doc.ref;
        
        if (action === "transfer") {
          batch.update(athleteRef, { 
            collective_member_ref: targetCollectiveId,
            modifiedAt: now,
            modifiedBy: userEmail
          });
        } else {
          batch.update(athleteRef, { 
            collective_member_ref: null,
            modifiedAt: now,
            modifiedBy: userEmail
          });
        }
      });
    }

    //  Commit all changes at once
    await batch.commit();

    return res.status(200).send({ 
      message: `Successfully terminated ${collectiveId}. ${athletesQuery.size} athletes updated via ${action}.` 
    });

  } catch (error) {
    console.error("TERMINATION_ERROR:", error);
    return res.status(500).send({ error: error.message });
  }
});

exports.api = onRequest({ region: "europe-west3" }, app)