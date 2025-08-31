const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Verify Firebase ID token from 'Authorization: Bearer <idToken>'
async function verifyFirebaseIdToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing bearer token" });
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    logger.error(err);
    res.status(401).json({ error: "Unauthorized" });
  }
}

app.get("/status", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.get("/me", verifyFirebaseIdToken, (req, res) => {
  res.json({ uid: req.user.uid });
});

// Example Firestore secured route
const { getFirestore } = require("firebase-admin/firestore");
const db = getFirestore();

app.post("/items", verifyFirebaseIdToken, async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });
  const ref = await db.collection("items").add({ name, owner: req.user.uid, createdAt: Date.now() });
  res.json({ id: ref.id });
});

// Export a single API endpoint under /api/*
exports.api = onRequest({ region: "europe-west3" }, app);
