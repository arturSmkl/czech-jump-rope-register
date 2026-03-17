const { Timestamp } = require("firebase-admin/firestore");

// dd-mm-yyyy to Firestore Timestamp
const parseDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return null;
  
  const parts = dateStr.trim().split("-");
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; 
  const year = parseInt(parts[2], 10);

  const dateObj = new Date(year, month, day);

  return isNaN(dateObj.getTime()) ? null : Timestamp.fromDate(dateObj);
};

const commitIfFull = async (batch, count, db) => {
  if (count > 0 && count % 499 === 0) {
    await batch.commit();
    return db.batch();
  }
  return batch;
};

module.exports = { parseDate, commitIfFull };