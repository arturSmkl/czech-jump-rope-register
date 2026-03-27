# Green Team Patch Summary — Cycle 001

## Fixed Issues

| Issue | Commit | Description |
|-------|--------|-------------|
| F-001 | 248ccef | `uploadRegistered` now posts to `/registered/import` instead of `/collectives/import` |
| F-002 | 360c697 | `commitIfFull` now returns `{ batch, count }` so callers reset their counter to 0 after a mid-stream commit |
| F-003 | 360c697 | `opCount`/`operationCount` is now incremented before calling `commitIfFull`, so the guard always sees the true pending count (fixed in same commit as F-002) |
| F-004 | ede5cf2 | Both `importService.js` and `exportService.js` now use `API_URL = "/api"` — routed by Vite proxy in dev and Firebase Hosting rewrite in production |
| F-006 | ab3bad7 | `exportRegistered` row mapping now reads `address.street` and `address.house_number` instead of the non-existent `address.street_and_number` |
| F-007 | 1c55ddc | `isValidCollectiveReference` in `firestore.rules` replaced `exists()` + `get()` (2 reads) with a single `get()`, staying within the 3-read-per-rule limit |
| F-008 | b22657f | `onAuthStateChanged` callback now checks `router.currentRoute.value.path` before pushing to avoid redundant navigation; errors are caught to suppress NavigationDuplicated |
| F-009 | e13c522 | `deleteCollective` now rejects with 400 if any associated registered member is still active |
| F-011 | ab3bad7 | `exportRegistered` data rows now have 19 columns matching the 19-column header (`athlete`, `street`, `house_number`, `nationality_code` were missing — fixed in same commit as F-006) |
| F-013 | 44e9b79 | `getUserAuthorization` now lowercases and trims email before the Firestore doc lookup |
| F-016 | 8453b54 | CORS `origin: true` replaced with an explicit allowlist of known Firebase Hosting and local dev origins |

## Skipped Issues

| Issue | Reason |
|-------|--------|
| F-005 | The backend `terminateCollective` uses Firebase Admin SDK which bypasses Firestore security rules entirely. There is no actual rule evaluation against `request.time` for Admin SDK writes, so the JS clock vs. `request.time` inconsistency has no real impact. |

## Final Build Status

`cd frontend && npx vite build` — **PASSED** (720ms, 58 modules transformed, no errors)
