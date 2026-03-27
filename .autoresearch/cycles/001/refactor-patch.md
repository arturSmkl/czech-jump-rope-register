## Changes: 4

## Refactoring Summary

### 1. Remove no-op try/catch wrappers in `exportService.js`
The four exported functions (`downloadCollectiveExport`, `downloadRegisteredExport`, `downloadRegisteredExportNsa`, `downloadOverviewPdf`) each wrapped their inner call in a try/catch that only re-threw the error. Replaced each with a direct arrow function returning the inner call. Removes ~32 lines of ceremony.

### 2. Remove no-op try/catch wrappers in `importService.js`
Same pattern: `uploadCollectives` and `uploadRegistered` each had a try/catch that only re-threw. Replaced with direct arrow functions. Also used ES shorthand property (`{ data }` instead of `{ data: data }`).

### 3. Use `COLLECTION_NAME` constant consistently in `authService.js`
`getUserAuthorization` used a hardcoded `'authorized_users'` string literal (line 36) instead of the `COLLECTION_NAME` constant defined at the top of the file. Changed to use the constant for consistency with all other functions in the file.

### 4. Remove redundant `Access-Control-Expose-Headers` in route handlers
`collectives.js` (`exportCollectives`) and `registered.js` (`exportRegistered`, `exportRegisteredNsa`) each manually set `res.setHeader("Access-Control-Expose-Headers", "Content-Disposition")`. This header is already added to every response by the `cors()` middleware in `index.js` via `exposedHeaders: ['Content-Disposition']`. Removed the 3 redundant manual `setHeader` calls.

## Test Result
Build passes: `npx vite build` completes successfully in ~712ms, 58 modules transformed.

## Files Changed
- `frontend/src/services/exportService.js`
- `frontend/src/services/importService.js`
- `frontend/src/services/authService.js`
- `backend/functions/src/routes/collectives.js`
- `backend/functions/src/routes/registered.js`
