# Cycle 001 — Eval Results

## Test status
BUILD PASS — `npx vite build` exits 0

## Commits this cycle (10 total)
- 248ccef fix: [F-001] uploadRegistered posts to correct /registered/import endpoint
- 360c697 fix: [F-002][F-003] reset batch counter after mid-stream commit and increment before guard check
- ede5cf2 fix: [F-004] replace hard-coded localhost API URL with relative /api path
- ab3bad7 fix: [F-006][F-011] exportRegistered reads correct address fields and includes all 19 CSV data columns
- 1c55ddc fix: [F-007] replace exists()+get() with single get() in isValidCollectiveReference
- b22657f fix: [F-008] guard against double-navigation race by checking current route before pushing
- e13c522 fix: [F-009] reject deleteCollective when associated members are still active
- 44e9b79 fix: [F-013] lowercase email before Firestore lookup in getUserAuthorization
- 8453b54 fix: [F-016] restrict CORS to known origins instead of reflecting any origin
- 8d2248f refactor: remove redundant try/catch wrappers and duplicate headers

## Files changed
- backend/functions/index.js
- backend/functions/src/middleware/utils.js
- backend/functions/src/routes/collectives.js
- backend/functions/src/routes/registered.js
- firestore.rules
- frontend/src/services/authService.js
- frontend/src/services/exportService.js
- frontend/src/services/importService.js
- frontend/src/stores/authStore.js

## Fixed this cycle
- F-001: Wrong API endpoint in uploadRegistered (critical)
- F-002+F-003: Batch counter not reset + off-by-one in flush guard (high)
- F-004: Hardcoded localhost URL replaced with /api (high)
- F-006+F-011: exportRegistered field name wrong + CSV column count mismatch (high)
- F-007: Firestore rule read limit exceeded (high)
- F-008: Auth double-navigation race (medium)
- F-009: deleteCollective cascade-deletes active members (medium)
- F-013: Email case sensitivity in getUserAuthorization (medium)
- F-016: CORS allows any origin (medium)

## Skipped
- F-005: Admin SDK bypasses Firestore security rules; JS clock vs. request.time has no real effect on backend writes

## Remaining open issues
See ideas.md — F-010, F-012, F-014, F-015, F-017, F-018, F-019, F-020, test coverage gaps

## Ending commit
8d2248fc206673ad369def287c74417cb2d53ee8
