const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const { onRequest } = require("firebase-functions/v2/https");
const { validateRole } = require("./src/middleware/auth.js");
const { importCollectives, terminateCollective, transferRegisteredMembers } = require("./src/routes/collectives");
const { importRegistered } = require("./src/routes/registered.js");

admin.initializeApp();
const db = admin.firestore();
const app = express();

// change for production to frontend URL
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json())

/**
 * Body: { 
 * collectiveId: "ID_OF_CLUB"
 * }
 */
app.post("/collectives/terminate-collective",
  validateRole(['admin', 'editor']),
  (req, res) => terminateCollective(req, res, db)
);

/**
 * Body: { 
 * collectiveId: "ID_OF_CLUB"
 * action: "nullify" | "nullify_and_terminate" | "transfer"
 * targetCollectiveId: "ID_OF_TARGET_CLUB" (required if action is "transfer")
 * }
 */
app.post("/collectives/transfer-registered-members",
  validateRole(['admin', 'editor']),
  (req, res) => transferRegisteredMembers(req, res, db)
);

/**
 * Body: { 
 * data: [{}, {}, ...]
 * }
 */
app.post("/collectives/import-collectives", 
  validateRole(["admin", "editor"]), 
  (req, res) => importCollectives(req, res, db)
);

/**
 * Body: { 
 * data: [{}, {}, ...]
 * collective_member_ref: "ID_OF_ASSOCIATED_CLUB" (optional, but if provided must be valid)
 * }
 */
app.post("/registered/import-registered",
  validateRole(["admin", "editor"]),
  (req, res) => importRegistered(req, res, db)
);

exports.api = onRequest({ region: "europe-west3" }, app)