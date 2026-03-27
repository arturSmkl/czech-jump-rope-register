# Autoresearch session: czech-jump-rope-register

## Target
- Path: /Users/jirifabian/workspace/1.it/czech-jump-rope-register
- Stack: Node/JS (Vue 3 frontend + Firebase Cloud Functions backend)
- Test command: cd /Users/jirifabian/workspace/1.it/czech-jump-rope-register/frontend && npx vite build
- Linter: none configured
- Branch: autoresearch/improve
- Config: none
- Scope: all files

## Baseline
- Tests: BUILD PASS (vite build exits 0)
- Base commit: ebaa9ae62351e0af40349370e4ee8c29fbe6bfbf
- Date: 2026-03-27

## Cycles completed
- Cycle 001: 10 commits, 9 bugs fixed, 1 refactor. Ending commit: 8d2248fc206673ad369def287c74417cb2d53ee8

## What's been tried
- F-001: Wrong API endpoint in uploadRegistered
- F-002+F-003: Batch counter not reset + off-by-one in flush guard
- F-004: Hardcoded localhost URL in importService.js + exportService.js
- F-005: Attempted — skipped (Admin SDK bypasses Firestore rules; no real impact)
- F-006+F-011: exportRegistered wrong field name + CSV column count mismatch
- F-007: Firestore rule isValidCollectiveReference exceeded 3-read limit
- F-008: Auth store double-navigation race on login/logout
- F-009: deleteCollective cascade-deletes active members with no guard
- F-013: getUserAuthorization not lowercasing email
- F-016: CORS reflects any origin

## Open issues
- F-010: transferRegisteredMembers silent success on invalid source collectiveId
- F-012: Firestore rules validate flat schema but backend writes nested objects
- F-014: Partial import failure leaves no breadcrumb
- F-015: No input size limit on import endpoints
- F-017: NSA export missing CSV injection guard
- F-018: parseDate local timezone assumption
- F-019: PDF doc.y manual offset may overlap content
- F-020: Backend does not enforce email_verified unlike Firestore rules
- Test coverage: no backend, Firestore rules, or frontend tests
