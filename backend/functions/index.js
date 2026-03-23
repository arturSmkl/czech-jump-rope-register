const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const { onRequest } = require("firebase-functions/v2/https");
const { validateRole } = require("./src/middleware/auth.js");
const {
  importCollectives,
  exportCollectives,
  terminateCollective,
  deleteCollective
  } = require("./src/routes/collectives");
const {
  exportRegistered,
  importRegistered,
  exportRegisteredNsa,
  transferRegisteredMembers
} = require("./src/routes/registered.js");
const { generateOverviewPDF } = require("./src/routes/reports.js");

admin.initializeApp();
const db = admin.firestore();
const app = express();

// change for production to frontend URL
app.use(cors({ 
  origin: true, 
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // This allows your frontend to read the filename header
  exposedHeaders: ['Content-Disposition'] 
}));
app.use(express.json())

/**
 * Body: { 
 * data: [{}, {}, ...]
 * }
 */
app.post("/collectives/import", 
  validateRole(["admin", "editor"]), 
  (req, res) => importCollectives(req, res, db)
);

app.get("/collectives/export",
  validateRole(["admin", "editor"]),
  async (req, res) => exportCollectives(req, res, db)
);

/**
 * Body: { 
 * collectiveId: "ID_OF_CLUB"
 * action: "nullify" | "nullify_and_terminate" | "transfer"
 * targetCollectiveId: "ID_OF_TARGET_CLUB" (required if action is "transfer")
 * }
 */
app.post("/registered/transfer",
  validateRole(['admin', 'editor']),
  (req, res) => transferRegisteredMembers(req, res, db)
);

/**
 * Body: { 
 * collectiveId: "ID_OF_CLUB"
 * }
 */
app.post("/collectives/terminate",
  validateRole(['admin', 'editor']),
  (req, res) => terminateCollective(req, res, db)
);

/**
 * Body: { 
 * collectiveId: "ID_OF_CLUB"
 * }
 */
app.delete("/collectives/delete",
  validateRole(['admin', 'editor']),
  (req, res) => deleteCollective(req, res, db)
);



/**
 * Body: { 
 * data: [{}, {}, ...]
 * collective_member_ref: "ID_OF_ASSOCIATED_CLUB" (optional)
 * }
 */
app.post("/registered/import",
  validateRole(["admin", "editor"]),
  (req, res) => importRegistered(req, res, db)
);

app.get("/registered/export/:collectiveId",
  validateRole(["admin", "editor"]),
  async (req, res) => exportRegistered(req, res, db)
);

app.get("/registered/export-nsa",
  validateRole(["admin", "editor"]),
  async (req, res) => exportRegisteredNsa(req, res, db)
);



app.get("/reports/overview",
  validateRole(["admin", "editor"]),
  async (req, res) => generateOverviewPDF(req, res, db)
);

exports.api = onRequest({ region: "europe-west3" }, app)