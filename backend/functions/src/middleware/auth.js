const admin = require("firebase-admin");

const validateRole = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      // Check if user is logged in 
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!token) return res.status(401).json({ error: "Unauthorized" });

      const decoded = await admin.auth().verifyIdToken(token);
      const email = decoded.email.toLowerCase();

      // Look up role in Firestore 'authorized_users'
      const userDoc = await admin.firestore().collection("authorized_users").doc(email).get();
      
      if (!userDoc.exists) {
        return res.status(403).json({ error: "User not in whitelist" });
      }

      const userData = userDoc.data();
      if (!allowedRoles.includes(userData.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      // Attach user info for use in the endpoint
      req.user = { ...decoded, role: userData.role };
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };
};

module.exports = { validateRole };