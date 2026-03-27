# Backlog ideas (deferred findings)

## Deferred from Cycle 001

### [F-010] `transferRegisteredMembers` silent success on invalid source collectiveId
- Location: backend/functions/src/routes/registered.js:330-334
- Issue: No existence check for `collectiveId` before querying; returns 200 "No members to update" on bad input.
- Impact: Callers receive no indication that the source club ID was invalid.

### [F-012] Firestore rules schema for `collective_members` validates flat fields but backend writes nested objects
- Location: firestore.rules:62-85, backend/functions/src/routes/collectives.js:64-83
- Issue: `isValidCollectiveSchema` expects flat fields but backend writes nested `address` and `contact_person` objects.
- Impact: Firestore rules are ineffective — they validate a schema the backend never produces.

### [F-014] Partial import failure leaves no breadcrumb
- Location: backend/functions/src/middleware/utils.js:62-68
- Issue: Mid-stream batch commit error propagates to a generic 500 with no per-record diagnostic.
- Impact: Partial imports corrupt database state silently.

### [F-015] No input size limit on import endpoints
- Location: backend/functions/index.js:32
- Issue: No application-level cap on `records.length`.
- Impact: Unbounded imports can cause function timeouts and partial data commits.

### [F-017] NSA export missing CSV injection prefix guard
- Location: backend/functions/src/routes/registered.js:279-282
- Issue: Sanitizes `;` but not `=`, `+`, `-`, `@` at start of values.
- Impact: Formula injection in Excel for affected member names.

### [F-018] `parseDate` local timezone assumption
- Location: backend/functions/src/middleware/utils.js:22-34
- Issue: `new Date(year, month, day)` is local-timezone; currently safe (UTC) but fragile.

### [F-019] PDF `doc.y` manual offset may overlap content
- Location: backend/functions/src/routes/reports.js:68
- Impact: Minor visual layout defect in generated PDFs.

### [F-020] Backend does not enforce email verification unlike Firestore rules
- Location: backend/functions/src/middleware/auth.js:11, firestore.rules:10
- Impact: Inconsistent security boundary for unverified-email users.

### Test coverage gaps (T-001 to T-004)
- No backend, Firestore rules, or frontend tests exist. Large effort worth planning separately.
