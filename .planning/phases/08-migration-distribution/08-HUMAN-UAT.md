<!-- leak-grep-allow file — UAT document; @.planning/* refs are documentation context, not auto-loaded skill content -->
---
status: partial
phase: 08-migration-distribution
source: [08-VERIFICATION.md]
started: 2026-05-13T23:30:00Z
updated: 2026-05-13T23:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. First green `upstream-parity` CI run on a real PR
expected: After fixing the two design findings from 2026-05-13's first run (`verify.commits` needs git-history seeding in upstream-checkout; `STATE.md` fixture absent in upstream-checkout), open a real PR against `feat/storage-adapter` or `main` and observe the `upstream-parity` workflow complete with green status. Captures the human-verification debt explicitly recorded in `08-05-SUMMARY.md` deviations.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
