const { Timestamp } = require("firebase-admin/firestore");

// dd-mm-yyyy to Firestore Timestamp
const parseDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return null;
  
  const str = dateStr.trim();

  // Strict Format Check: dd-mm-yyyy
  // ^\d{2} = starts with 2 digits
  // - = literal hyphen
  // \d{4}$ = ends with 4 digits
  const regex = /^\d{2}-\d{2}-\d{4}$/;
  if (!regex.test(str)) return null;

  // Extract parts
  const [dStr, mStr, yStr] = str.split("-");
  const day = parseInt(dStr, 10);
  const month = parseInt(mStr, 10) - 1; // JS months are 0-11
  const year = parseInt(yStr, 10);

  // Create Date object
  const dateObj = new Date(year, month, day);

  // Logical Validation (The "Drift" Check)
  // We check if the values we get back match exactly what we put in.
  const isValidDate = 
    dateObj.getFullYear() === year &&
    dateObj.getMonth() === month &&
    dateObj.getDate() === day;

  if (!isValidDate) return null;

  return Timestamp.fromDate(dateObj);
};

// Firestore Timestamp to dd-mm-yyyy
const formatFirestoreDate = (timestamp) => {
  if (!timestamp || typeof timestamp.toDate !== 'function') return "";
  
  const date = timestamp.toDate();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).padStart(4, '0');
  
  return `${day}-${month}-${year}`;
};

// Formats Firestore Timestamp to d.m.yyyy (no leading zeros)
const formatNSADate = (timestamp) => {
  if (!timestamp || typeof timestamp.toDate !== 'function') return "";
  
  const date = timestamp.toDate();
  const day = date.getDate(); 
  const month = date.getMonth() + 1; 
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
};

// Commits the batch if the count exceeds Firestore's limit and returns a new batch
const commitIfFull = async (batch, count, db) => {
  if (count > 0 && count % 499 === 0) {
    await batch.commit();
    return db.batch();
  }
  return batch;
};

// Prevents CSV injection by prefixing suspicious characters with a single quote
const sanitizeForCsv = (val) => {
  if (val === null || val === undefined) return "";
  let str = String(val).replace(/"/g, '""'); // Escape existing quotes
  
  if (['=', '+', '-', '@'].includes(str.charAt(0))) {
    return `'${str}`;
  }
  return str;
};

module.exports = { parseDate, formatFirestoreDate, formatNSADate, commitIfFull, sanitizeForCsv };