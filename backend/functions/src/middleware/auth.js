const admin = require("firebase-admin");

const validateRole = (allowedRoles) => {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (err) {
      console.error("AUTH_VERIFY_FAILED:", err.code || err.name, err.message);
      return res.status(401).json({ error: "Invalid token" });
    }

    if (!decoded.email) {
      console.error("AUTH_NO_EMAIL: token has no email claim", { uid: decoded.uid });
      return res.status(403).json({ error: "Token has no email claim" });
    }

    const email = decoded.email.toLowerCase();

    try {
      const userDoc = await admin.firestore().collection("authorized_users").doc(email).get();

      if (!userDoc.exists) {
        return res.status(403).json({ error: "User not in whitelist" });
      }

      const userData = userDoc.data();
      if (!allowedRoles.includes(userData.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      req.user = { ...decoded, role: userData.role };
      next();
    } catch (err) {
      console.error("AUTH_LOOKUP_FAILED:", err.code || err.name, err.message);
      return res.status(500).json({ error: "Authorization lookup failed" });
    }
  };
};

module.exports = { validateRole };