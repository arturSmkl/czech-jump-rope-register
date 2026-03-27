# Red Team Findings — Cycle 001
**Project:** czech-jump-rope-register
**Date:** 2026-03-27

---

## Critical

### [F-001] `uploadRegistered` calls the wrong API endpoint
- Location: `frontend/src/services/importService.js:40`
- Issue: `uploadRegistered` posts to `/collectives/import` instead of `/registered/import`. The `collective_member_ref` parameter it constructs is therefore never processed by the registered-member import handler.
- Impact: Every attempt to import registered members through the frontend silently imports them as collectives (and fails validation) rather than as registered members. The feature is completely broken for end-users.

---

## High

### [F-002] Batch counter not reset after a mid-stream commit (`commitIfFull`)
- Location: `backend/functions/src/middleware/utils.js:62-68`, used in `backend/functions/src/routes/collectives.js:86-95`, `backend/functions/src/routes/registered.js:116-122`
- Issue: `commitIfFull` commits and returns a fresh batch when `count % 499 === 0`, but the calling code never resets `opCount`/`operationCount` to 0 after the mid-stream commit. The modulo condition will never trigger again (e.g., at 998 ops), so the next 499-op window is never flushed — the new batch accumulates indefinitely until the final `batch.commit()`.
- Impact: Imports larger than 499 records that are a multiple of 499 rows will silently accumulate more than 500 pending operations in a single batch, causing Firestore to reject the final commit with a "INVALID_ARGUMENT: maximum 500 writes" error and rolling back the entire import.

### [F-003] `opCount` is not incremented before calling `commitIfFull` — off-by-one in batch-flush guard
- Location: `backend/functions/src/routes/collectives.js:86`, `backend/functions/src/routes/registered.js:116`
- Issue: `commitIfFull(batch, opCount, db)` is called before `batch.set(...)`, but `opCount` is incremented only afterwards (line 95 / 125). This means the guard evaluates the count that does not yet include the current operation, so the actual batch can reach 500 operations before being flushed (off-by-one relative to Firestore's 500-write limit).
- Impact: With exactly 500 records the final batch will contain 500 writes (the 500th is added after the last pre-commit check passes at 499), hitting Firestore's hard limit and causing a commit error.

### [F-004] `hardcoded localhost` API URL in production-deployed frontend services
- Location: `frontend/src/services/importService.js:3`, `frontend/src/services/exportService.js:3`
- Issue: Both service files hard-code `http://127.0.0.1:5001/...` as `API_URL`. In production the frontend is hosted on Firebase Hosting which rewrites `/api/**` to the deployed Cloud Function, but both services bypass that rewrite and always target the local emulator address.
- Impact: All import and export calls fail in production with a network error. No environment variable or build-time switch is used to select the correct URL.

### [F-005] Firestore security rule allows a terminated club's `membership_extinction_date` to be set to a future timestamp
- Location: `firestore.rules:131`
- Issue: `isPastOrNowTimestampOrNull` enforces that `membership_extinction_date` cannot be in the future for registered members, but on the collective side (`firestore.rules:84`) the client is restricted to `null` only (the backend sets real dates). However the backend `terminateCollective` endpoint accepts any caller-supplied `terminationDate` string that converts to today-or-earlier, validated against the JS clock (`new Date()`), not Firestore server time. A race condition or clock skew between function execution and `request.time` can allow a value that was valid at call-time to exceed `request.time` when the Firestore rule evaluates it.
- Impact: This is a narrow window, but the inconsistency between JS `new Date()` and Firestore `request.time` could occasionally allow writes that the rule should reject, or more dangerously, writes that appear valid to the function but fail mid-batch.

### [F-006] `exportRegistered` maps wrong field name — reads `address.street_and_number` but data is stored as `address.street` + `address.house_number`
- Location: `backend/functions/src/routes/registered.js:170`
- Issue: In `exportRegistered`, the row mapping reads `data.address?.street_and_number` (line 170), but `importRegistered` stores the address as separate fields `address.street` and `address.house_number` (lines 97-98). The field `address.street_and_number` does not exist on registered members.
- Impact: The street column in every exported registered-member CSV is always empty, making the export data incorrect for all records.

### [F-007] `isValidCollectiveReference` in Firestore rules performs extra `get()` calls which count against the 3-read-per-request billing limit and can cause rule evaluation to fail silently
- Location: `firestore.rules:143-152`
- Issue: The `isValidCollectiveReference` function calls `exists()` and `get()` on `collective_members`. Together with `getUserRole()` (also a `get()` call), a single `create` or `update` on `registered_members` may consume more than 3 external document reads allowed in Firestore security rule evaluation per request.
- Impact: Legitimate create/update operations may be denied with a permission error even when they should be allowed, resulting in intermittent write failures that are difficult to debug.

---

## Medium

### [F-008] `authStore.init()` resolves before the `onAuthStateChanged` callback fully populates derived state on re-entry
- Location: `frontend/src/stores/authStore.js:19-52`, `frontend/src/router/index.js:30`
- Issue: `init()` returns a `Promise` that resolves on the first `onAuthStateChanged` callback. However the router guard calls `await authStore.init()` on every navigation when `isInitialLoad` is true, so on the very first call it awaits correctly — but subsequent navigation after logout/login triggers the reactive `onAuthStateChanged` callback which runs asynchronously, calling `router.push()` inside the callback while a `beforeEach` guard is also trying to evaluate the same state. This can produce a double-navigation race.
- Impact: Users may briefly see the wrong view or encounter `NavigationDuplicated` Vue Router warnings on login/logout events.

### [F-009] `deleteCollective` does not reject if associated registered members are still active (not terminated)
- Location: `backend/functions/src/routes/collectives.js:253-257`
- Issue: The guard only checks that the collective itself has been terminated before allowing deletion (line 238). It does not verify that all associated registered members are also terminated. It then cascade-deletes all associated registered members regardless of their status.
- Impact: An editor could delete a collective with active (non-terminated) registered members, permanently destroying their records with no warning.

### [F-010] `transferRegisteredMembers` does not validate that `collectiveId` actually exists
- Location: `backend/functions/src/routes/registered.js:330-334`
- Issue: The function validates the target club (for `transfer` action) but never checks whether `collectiveId` (the source club) exists in Firestore. If a caller provides a non-existent `collectiveId`, the query on line 330 simply returns 0 docs and the function returns 200 with "No members to update."
- Impact: Silent success on a bad input — callers receive no indication that the source club ID was invalid.

### [F-011] `exportRegistered` does not include the `athlete` column in the CSV output but it is in `ALLOWED_CSV_FIELDS` header
- Location: `backend/functions/src/routes/registered.js:160-183`
- Issue: The `values` array mapped on lines 163-181 has 16 entries, but `ALLOWED_CSV_FIELDS` has 19 entries (includes `first_name`, `last_name`, `birth_number`, `sex`, `date_of_birth`, `street`, `house_number`, …`athlete`, `referee`, `coach`, `id`). The `athlete` field is present in the header row but missing from the data rows, and `street` and `house_number` are also absent — replaced by the wrong `address.street_and_number` (see F-006). The column count mismatch breaks CSV parsing in downstream tools.
- Impact: Exported CSV has a header with 19 columns but only 16 data columns per row; the file is structurally malformed.

### [F-012] Firestore rules schema validation for `collective_members` does not match the nested object structure the backend actually writes
- Location: `firestore.rules:62-85`, `backend/functions/src/routes/collectives.js:64-83`
- Issue: `isValidCollectiveSchema` on the Firestore rule side expects flat top-level fields like `street_and_number`, `zip_code`, `township`, `country`, `contact_person_first_name`, etc. (line 62-68). However the backend writes nested objects: `address: { street_and_number, zip_code, township, country }` and `contact_person: { first_name, last_name, email, phone_number }` (lines 66-78). Direct client-side writes (through `firestoreService.js`) therefore pass the schema check but the backend never writes the flat structure, meaning the rules validate a schema that the backend does not produce.
- Impact: The Firestore rules are ineffective — any client that writes the flat schema passes rule validation and stores data in a different shape than what the backend produces, causing inconsistent document structures in the database.

### [F-013] `getUserAuthorization` in the frontend queries Firestore with the original email case, not lowercased
- Location: `frontend/src/services/authService.js:36`
- Issue: `getUserAuthorization` calls `doc(db, 'authorized_users', email)` using the raw `email` from Google Auth, which may be mixed-case. The backend middleware (`auth.js:12`) lowercases the email with `decoded.email.toLowerCase()`, and `upsertUser` lowercases before writing (line 18). But `getUserAuthorization` does not lowercase. If Google returns an email with uppercase characters, the document lookup will fail to find the user.
- Impact: Users whose Google accounts return mixed-case emails are treated as non-whitelisted even though they are in the database, blocking legitimate access.

### [F-014] `commitIfFull` is awaited but error from the commit is not handled separately — a partial import failure leaves no breadcrumb
- Location: `backend/functions/src/middleware/utils.js:62-68`
- Issue: If `batch.commit()` inside `commitIfFull` throws, the error propagates up through the `for` loop and is caught by the outer `try/catch` in the route handlers, which return a generic 500 error. At that point, the first N batches (any that committed successfully before the failure) have already been written to Firestore — the import is partially applied with no way to distinguish which records were committed and which were not.
- Impact: Partial imports corrupt the database state silently; the UI shows an error but cannot tell the user which records were applied.

### [F-015] No input size limit on import endpoints — unbounded request bodies allowed
- Location: `backend/functions/index.js:32`
- Issue: `app.use(express.json())` is called without a `limit` option. Express's default is 100 kB, but Firebase Cloud Functions may override this. More importantly there is no application-level cap on `records.length` before beginning batch operations.
- Impact: A malicious or erroneous client can send thousands of records, causing very long-running function executions, high Firestore write costs, and potential function timeouts that leave partial data committed (see F-014).

### [F-016] `cors` configured with `origin: true` (reflect any origin) in production
- Location: `backend/functions/index.js:25-31`
- Issue: The comment says "change for production to frontend URL" but `origin: true` reflects any origin back as allowed, effectively disabling same-origin protection for all API endpoints.
- Impact: Any website can make credentialed cross-origin requests to the API. While auth token validation still protects against unauthorized actions, CSRF-style attacks and unexpected cross-origin data access are easier to carry out.

---

## Low

### [F-017] `sanitizeForCsv` in the NSA export (`exportRegisteredNsa`) strips semicolons but does not apply the CSV injection prefix guard
- Location: `backend/functions/src/routes/registered.js:279-282`
- Issue: The NSA export manually sanitizes by replacing `;` with a space and wrapping in quotes (lines 279-282) rather than using the shared `sanitizeForCsv` utility. The `sanitizeForCsv` utility also guards against CSV injection characters (`=`, `+`, `-`, `@` at the start of a value). The NSA export omits that guard.
- Impact: A registered member whose name starts with `=`, `+`, or `@` could trigger formula injection if the NSA export is opened in Excel.

### [F-018] `parseDate` uses local server timezone, not UTC, creating date ambiguity at midnight
- Location: `backend/functions/src/middleware/utils.js:22-34`
- Issue: `new Date(year, month, day)` (line 22) creates a date in the Node.js process's local timezone. Firebase Cloud Functions run in UTC+0, so this is currently safe — but the date parsed from a user input of "01-01-2025" will be midnight UTC, while the Firestore security rule `isPastOrNowTimestampOrNull` compares against `request.time` which is also UTC. If the Cloud Function is ever deployed in a non-UTC region or timezone configuration, midnight dates will be off by one day.
- Impact: Low risk currently, but a silent timezone assumption that will break if the hosting region changes.

### [F-019] PDF generation: `doc.y` is modified manually with `doc.y += 80` after image insertion — position may overlap content
- Location: `backend/functions/src/routes/reports.js:68`
- Issue: After inserting the logo image, the code manually advances `doc.y` by 80 points (line 68). If the image fails to load (caught and rejected on line 63-65), the `doc.y` is not adjusted, but if the image loads asynchronously and takes less or more space than expected, the title text on line 70 may overlap or leave excessive whitespace. PDFKit's `image()` does not update `doc.y` automatically for `fit`-sized images.
- Impact: Minor visual layout defect in the generated PDF; not a security or data correctness issue.

### [F-020] `isAuthenticated()` in Firestore rules requires `email_verified == true`, but the backend middleware does not enforce email verification
- Location: `backend/functions/src/middleware/auth.js:11`, `firestore.rules:10`
- Issue: The Firestore security rule's `isAuthenticated()` function checks `request.auth.token.email_verified == true`. The backend middleware verifies the Firebase ID token (`verifyIdToken`) but does not check `decoded.email_verified`. A user with an unverified email can call all API endpoints via the backend but cannot directly write to Firestore.
- Impact: Inconsistent security boundary: backend routes accept unverified-email users, Firestore rules do not. This is an auditable gap rather than an immediately exploitable one.

---

## Test Coverage Gaps

### [T-001] No tests exist for any backend route or utility
- Location: `backend/functions/` (no test files found)
- Issue: The `package.json` includes `firebase-functions-test` as a dev dependency but no test files are present. All route handlers, the batch-flush logic, date parsing, and CSV sanitization are completely untested.
- Impact: Bugs like F-001, F-002, F-003, F-006, F-011 are not caught by any automated check and can only be found by manual inspection or live failures.

### [T-002] No tests for Firestore security rules
- Location: `firestore.rules` (no `*.test.js` files found)
- Issue: The rules contain non-trivial logic (schema validation, cross-document reference checks, audit field validation). No `@firebase/rules-unit-testing` test suite exists.
- Impact: Rule regressions (e.g., the schema mismatch in F-012) go undetected until they block real writes in production or during manual QA.

### [T-003] Frontend has no unit or component tests
- Location: `frontend/src/` (no test files found)
- Issue: The Vue components, Pinia stores, and service layer have no associated tests. Critical flows like the auth initialization race (F-008) and the wrong import endpoint (F-001) are invisible to automated pipelines.
- Impact: Any change to auth flow, routing logic, or API URLs can silently break the application.

### [T-004] No edge-case coverage for `parseDate` boundary conditions
- Location: `backend/functions/src/middleware/utils.js:4-35`
- Issue: `parseDate` accepts only `dd-mm-yyyy` but there are no tests for leap-year boundaries (`29-02-2000` vs `29-02-1900`), month overflow (`32-01-2025`), or the string `"00-00-0000"`.
- Impact: An invalid but tricky date string that slips past the drift check could store a corrupted Timestamp in Firestore.
