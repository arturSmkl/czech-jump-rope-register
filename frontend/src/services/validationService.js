import validator from 'validator';
import { rodnecislo } from 'rodnecislo';

/**
 * Normalize a Czech birth number by removing the slash (e.g. "900720/3117" -> "9007203117").
 */
function normalizeBirthNumber(value) {
  if (!value) return '';
  return String(value).replace(/\//g, '').trim();
}

/**
 * Validate a Czech birth number using the rodnecislo library.
 * Accepts values with or without a slash.
 * Returns true if valid, false if invalid.
 * Returns null if the value is empty (no validation needed).
 */
export function validateBirthNumber(value) {
  if (!value || String(value).trim() === '') return null;
  const normalized = normalizeBirthNumber(value);
  if (!normalized) return null;
  try {
    const rc = rodnecislo(normalized);
    return rc.isValid();
  } catch {
    return false;
  }
}

/**
 * Validate a date value. Accepts Firestore Timestamps, Date objects, or DD-MM-YYYY strings.
 * Checks that the date is a real calendar date.
 * Returns true if valid, false if invalid, null if empty.
 */
export function validateDate(value) {
  if (value == null) return null;

  let date;

  // Firestore Timestamp
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    date = value.toDate();
  }
  // Already a Date
  else if (value instanceof Date) {
    date = value;
  }
  // String format DD-MM-YYYY
  else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const match = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return false;
    const [, dd, mm, yyyy] = match;
    const day = parseInt(dd, 10);
    const month = parseInt(mm, 10);
    const year = parseInt(yyyy, 10);
    date = new Date(year, month - 1, day);
    // Verify the date components match (handles invalid dates like 31-02-2020)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return false;
    }
  }
  // Object with seconds (Firestore-like)
  else if (value && typeof value === 'object' && value.seconds != null) {
    date = new Date(value.seconds * 1000);
  }
  else {
    return false;
  }

  if (isNaN(date.getTime())) return false;

  // Check reasonable year range
  const year = date.getFullYear();
  if (year < 1900 || year > 2100) return false;

  return true;
}

/**
 * Validate date from dropdown components (day, month, year).
 * Returns true if valid, false if invalid (e.g. Feb 30), null if all empty.
 */
export function validateDateDropdowns(day, month, year) {
  if (day == null && month == null && year == null) return null;
  // Partially filled = invalid
  if (day == null || month == null || year == null) return false;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return false;
  }
  if (year < 1900 || year > 2100) return false;
  return true;
}

/**
 * Validate an email address.
 * Returns true if valid, false if invalid, null if empty.
 */
export function validateEmail(value) {
  if (!value || String(value).trim() === '') return null;
  return validator.isEmail(String(value).trim());
}

/**
 * Validate a Czech phone number.
 * Accepts formats: +420XXXXXXXXX, 00420XXXXXXXXX, XXXXXXXXX (9 digits).
 * Returns true if valid, false if invalid, null if empty.
 */
export function validateCzechPhone(value) {
  if (!value || String(value).trim() === '') return null;
  const phone = String(value).trim().replace(/\s+/g, '');
  // Czech phone: optional +420 or 00420 prefix, then 9 digits
  const pattern = /^(\+420|00420)?[1-9]\d{8}$/;
  return pattern.test(phone);
}

/**
 * Validate a company ID (IČO). Must be a number (digits only).
 * Returns true if valid, false if invalid, null if empty.
 */
export function validateCompanyId(value) {
  if (!value || String(value).trim() === '') return null;
  return /^\d+$/.test(String(value).trim());
}

/**
 * Validate sex field. Must be 'M', 'Z', or 'Ž'.
 * Returns true if valid, false if invalid, null if empty.
 */
export function validateSex(value) {
  if (!value || String(value).trim() === '') return null;
  const v = String(value).trim().toUpperCase();
  return v === 'M' || v === 'Z' || v === 'Ž';
}

/**
 * Validate a birth date (should be in the past and reasonable).
 * Returns true if valid, false if invalid, null if empty.
 */
export function validateBirthDate(value) {
  const dateValid = validateDate(value);
  if (dateValid === null || dateValid === false) return dateValid;

  let date;
  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else if (value && typeof value === 'object' && value.seconds != null) {
    date = new Date(value.seconds * 1000);
  } else {
    return dateValid;
  }

  // Birth date must be in the past
  if (date > new Date()) return false;
  return true;
}

/**
 * Validate birth date from dropdown components.
 */
export function validateBirthDateDropdowns(day, month, year) {
  const valid = validateDateDropdowns(day, month, year);
  if (valid === null || valid === false) return valid;
  const date = new Date(year, month - 1, day);
  if (date > new Date()) return false;
  return true;
}

/**
 * Validate origin date from dropdown components.
 * Origin date should be a valid date.
 */
export function validateOriginDateDropdowns(day, month, year) {
  return validateDateDropdowns(day, month, year);
}

/**
 * Validate extinction date from dropdown components.
 * Should be a valid date.
 */
export function validateExtinctionDateDropdowns(day, month, year) {
  return validateDateDropdowns(day, month, year);
}

// =============================
// Batch validation for import rows
// =============================

/**
 * Validate a collective member import row.
 * Returns an array of warning strings.
 */
export function validateCollectiveImportRow(row, rowNum) {
  const warnings = [];

  if (row.company_id) {
    if (validateCompanyId(row.company_id) === false) {
      warnings.push(`Řádek ${rowNum}: neplatné IČO „${row.company_id}" — musí být číslo`);
    }
  }

  if (row.contact_person_email) {
    if (validateEmail(row.contact_person_email) === false) {
      warnings.push(`Řádek ${rowNum}: neplatný email „${row.contact_person_email}"`);
    }
  }

  if (row.contact_person_phone_number) {
    if (validateCzechPhone(row.contact_person_phone_number) === false) {
      warnings.push(`Řádek ${rowNum}: neplatné telefonní číslo „${row.contact_person_phone_number}"`);
    }
  }

  if (row.membership_origin_date) {
    if (validateDate(row.membership_origin_date) === false) {
      warnings.push(`Řádek ${rowNum}: neplatné datum vzniku členství „${row.membership_origin_date}"`);
    }
  }

  if (row.membership_extinction_date) {
    if (validateDate(row.membership_extinction_date) === false) {
      warnings.push(`Řádek ${rowNum}: neplatné datum zániku členství „${row.membership_extinction_date}"`);
    }
  }

  return warnings;
}

/**
 * Validate a registered member import row.
 * Returns an array of warning strings.
 */
export function validateRegisteredImportRow(row, rowNum) {
  const warnings = [];

  if (row.sex) {
    if (validateSex(row.sex) === false) {
      warnings.push(`Řádek ${rowNum}: neplatné pohlaví „${row.sex}" — povolené hodnoty: M, Z, Ž`);
    }
  }

  if (row.birth_number) {
    if (validateBirthNumber(row.birth_number) === false) {
      warnings.push(`Řádek ${rowNum}: neplatné rodné číslo „${row.birth_number}"`);
    }
  }

  if (row.date_of_birth) {
    if (validateDate(row.date_of_birth) === false) {
      warnings.push(`Řádek ${rowNum}: neplatné datum narození „${row.date_of_birth}"`);
    }
  }

  if (row.membership_origin_date) {
    if (validateDate(row.membership_origin_date) === false) {
      warnings.push(`Řádek ${rowNum}: neplatné datum vzniku členství „${row.membership_origin_date}"`);
    }
  }

  if (row.membership_extinction_date) {
    if (validateDate(row.membership_extinction_date) === false) {
      warnings.push(`Řádek ${rowNum}: neplatné datum zániku členství „${row.membership_extinction_date}"`);
    }
  }

  if (row.medical_examination_validity) {
    if (validateDate(row.medical_examination_validity) === false) {
      warnings.push(`Řádek ${rowNum}: neplatné datum platnosti lékařské prohlídky „${row.medical_examination_validity}"`);
    }
  }

  // Boolean fields must be 'ano' or 'ne'
  for (const field of ['athlete', 'referee', 'coach']) {
    if (row[field] && row[field].trim() !== '') {
      const val = row[field].trim().toLowerCase();
      if (val !== 'ano' && val !== 'ne') {
        warnings.push(`Řádek ${rowNum}: neplatná hodnota „${row[field]}" pro ${field} — povolené hodnoty: ano, ne`);
      }
    }
  }

  return warnings;
}

// =============================
// Validation for Firestore member objects (used in MembersView)
// =============================

/**
 * Check if a value is empty/missing.
 */
function isEmpty(val) {
  return val == null || (typeof val === 'string' && val.trim() === '');
}

/**
 * Validate a collective member object from Firestore.
 * Returns an object with field names as keys and a reason string:
 *   'invalid' – value present but invalid
 *   'missing' – value is empty/missing
 */
export function validateCollectiveMember(cm) {
  const issues = {};

  // Required fields – flag if missing
  if (isEmpty(cm.name)) issues.name = 'missing';
  if (isEmpty(cm.company_id)) issues.company_id = 'missing';
  else if (validateCompanyId(cm.company_id) === false) issues.company_id = 'invalid';
  if (!cm.membership_origin_date) issues.membership_origin_date = 'missing';

  // Address parts
  if (!cm.address || isEmpty(cm.address.street)) issues.address_street = 'missing';
  if (!cm.address || isEmpty(cm.address.house_number)) issues.address_house_number = 'missing';
  if (!cm.address || isEmpty(cm.address.zip_code)) issues.address_zip_code = 'missing';
  if (!cm.address || isEmpty(cm.address.township)) issues.address_township = 'missing';
  if (!cm.address || isEmpty(cm.address.country)) issues.address_country = 'missing';

  // Contact person
  if (!cm.contact_person || isEmpty(cm.contact_person.first_name)) issues.contact_person_first_name = 'missing';
  if (!cm.contact_person || isEmpty(cm.contact_person.last_name)) issues.contact_person_last_name = 'missing';
  if (!cm.contact_person || isEmpty(cm.contact_person.email)) issues.contact_person_email = 'missing';
  else if (validateEmail(cm.contact_person.email) === false) issues.contact_person_email = 'invalid';
  if (!cm.contact_person || isEmpty(cm.contact_person.phone_number)) issues.contact_person_phone = 'missing';
  else if (validateCzechPhone(cm.contact_person.phone_number) === false) issues.contact_person_phone = 'invalid';

  // Date validation (only when present)
  if (cm.membership_origin_date && validateDate(cm.membership_origin_date) === false) {
    issues.membership_origin_date = 'invalid';
  }
  if (cm.membership_extinction_date && validateDate(cm.membership_extinction_date) === false) {
    issues.membership_extinction_date = 'invalid';
  }

  return issues;
}

/**
 * Validate a registered member object from Firestore.
 * Returns an object with field names and a reason string ('invalid' | 'missing').
 */
export function validateRegisteredMember(rm) {
  const issues = {};

  // Required fields – flag if missing
  if (isEmpty(rm.first_name)) issues.first_name = 'missing';
  if (isEmpty(rm.last_name)) issues.last_name = 'missing';
  if (isEmpty(rm.birth_number)) issues.birth_number = 'missing';
  else if (validateBirthNumber(rm.birth_number) === false) issues.birth_number = 'invalid';
  if (isEmpty(rm.sex)) issues.sex = 'missing';
  else if (validateSex(rm.sex) === false) issues.sex = 'invalid';
  if (!rm.date_of_birth) issues.date_of_birth = 'missing';
  else if (validateBirthDate(rm.date_of_birth) === false) issues.date_of_birth = 'invalid';
  if (isEmpty(rm.nationality_code)) issues.nationality_code = 'missing';
  if (!rm.membership_origin_date) issues.membership_origin_date = 'missing';
  else if (validateDate(rm.membership_origin_date) === false) issues.membership_origin_date = 'invalid';

  // Address parts
  if (!rm.address || isEmpty(rm.address.street)) issues.address_street = 'missing';
  if (!rm.address || isEmpty(rm.address.house_number)) issues.address_house_number = 'missing';
  if (!rm.address || isEmpty(rm.address.zip_code)) issues.address_zip_code = 'missing';
  if (!rm.address || isEmpty(rm.address.township)) issues.address_township = 'missing';
  if (!rm.address || isEmpty(rm.address.country)) issues.address_country = 'missing';

  // Optional dates – only flag if present and invalid
  if (rm.membership_extinction_date && validateDate(rm.membership_extinction_date) === false) {
    issues.membership_extinction_date = 'invalid';
  }
  if (rm.medical_examination_validity && validateDate(rm.medical_examination_validity) === false) {
    issues.medical_examination_validity = 'invalid';
  }

  // Competitions count
  if (rm.competitions_last_12_months == null || rm.competitions_last_12_months === '') {
    issues.competitions_last_12_months = 'missing';
  }

  return issues;
}
