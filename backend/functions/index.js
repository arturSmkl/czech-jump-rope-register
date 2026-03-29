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

const ALLOWED_ORIGINS = [
  "https://czech-jump-rope-register-e8dea.web.app",
  "https://czech-jump-rope-register-e8dea.firebaseapp.com",
  "http://localhost:5000",
  "http://localhost:5173",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5173"
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, mobile apps)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
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