---
phase: 08-migration-distribution
plan: "01"
subsystem: sdk-build-tooling
tags: [phase-8, pre-0, alias-generator, ci-unblock]
dependency_graph:
  requires: []
  provides: [alias-drift-ci-gate]
  affects: [test.yml, sdk/scripts/gen-command-aliases.ts, sdk/src/query/command-aliases.generated.ts, get-shit-done/bin/lib/command-aliases.generated.cjs]
tech_stack:
  added: []
  patterns: [two-file-generator, formatTs+formatCjs-formatter-pattern]
key_files:
  created: []
  modified:
    - sdk/scripts/gen-command-aliases.ts
    - sdk/src/query/command-aliases.generated.ts
    - get-shit-done/bin/lib/command-aliases.generated.cjs
    - .github/workflows/test.yml
decisions:
  - CJS output path uses two-segment `../../get-shit-done/bin/lib/` (from sdk/scripts/ up to sdk/ then up to repo root into get-shit-done/bin/lib/)
  - verify.fat-skills removed from VERIFY family in new artifact — manifest-driven; check script confirms correctness
metrics:
  duration: "~15 minutes"
  completed: "2026-05-13T17:21:51Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 8 Plan 01: Pre-0 Alias Generator Rewrite Summary

Rewrote `sdk/scripts/gen-command-aliases.ts` to emit both the typed TS artifact and CJS mirror in a single run, then re-enabled the alias-drift CI check that was bypassed at Phase 7 close-out.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Rewrite gen-command-aliases.ts to emit both TS and CJS artifacts | 4ca78021 | sdk/scripts/gen-command-aliases.ts, sdk/src/query/command-aliases.generated.ts, get-shit-done/bin/lib/command-aliases.generated.cjs |
| 2 | Regenerate artifacts + remove test.yml bypass | 799b1ae2 | .github/workflows/test.yml |

## Generator Rewrite Approach

The old generator used `JSON.stringify(entries, null, 2)` to produce pretty-printed double-quoted JSON and only wrote the TS artifact. It did not produce the CJS mirror at all.

The rewrite introduces two formatter functions:

**`formatTs(families: FamilySpec[]): string`** — emits:
- Docblock header with new regeneration hint
- `FamilyCommandAlias` interface export
- For each family: `export const ${constName}: readonly FamilyCommandAlias[] = [` + inline single-line entries with single-quoted strings + `] as const;`
- `export const ${subcommandConst} = new Set<string>(${constName}.map((entry) => entry.subcommand),);`

**`formatCjs(families: FamilySpec[]): string`** — emits:
- `'use strict';` header + JSDoc comment
- For each family: `const ${constName} = [` + same inline entry format + `];` + `const ${subcommandConst} = ${constName}.map((entry) => entry.subcommand);`
- `module.exports = { STATE_COMMAND_ALIASES, ..., STATE_SUBCOMMANDS, ... };`

A shared `FamilySpec` interface and array of 7 family specs drives both formatters, eliminating the previous per-family manual repetition.

## Artifact Diffs from Regeneration

The TS artifact (`sdk/src/query/command-aliases.generated.ts`) changed substantially:
- Old format: no `FamilyCommandAlias` interface, `as const` at array level, `new Set<string>(...)` on a single line per family, JSON-style double-quote strings (from JSON.stringify)
- New format: `FamilyCommandAlias` interface added, `readonly FamilyCommandAlias[]` type annotation, `new Set<string>(` split across two lines, single-quoted strings

One behavioral difference: `verify.fat-skills` is absent from the new TS artifact. This entry was in the old committed file but is no longer in the manifests; the generator is data-driven and the check script confirmed the regenerated content is correct.

The CJS artifact (`get-shit-done/bin/lib/command-aliases.generated.cjs`) had minimal changes — header comment wording updated, otherwise format was already correct (inline objects, single quotes, module.exports).

## check-command-aliases-fresh.mjs Status

Green: `node sdk/scripts/check-command-aliases-fresh.mjs` exits 0 with output `command alias artifacts are fresh`.

The check script validates:
- TS aliases in `sdk/dist/query/command-aliases.generated.js` match `toAliasEntries(MANIFEST, family)` for all 7 families
- CJS aliases in `get-shit-done/bin/lib/command-aliases.generated.cjs` match the same expected values

## test.yml bypass removal

Lines 163-181 (the `# TEMPORARILY DISABLED` comment block + `if: false` step) were replaced with:

```yaml
      - name: SDK generated alias artifact drift check
        if: matrix.os == 'ubuntu-latest' && matrix.node-version == 24
        shell: bash
        run: node sdk/scripts/check-command-aliases-fresh.mjs
```

No `if: false`, no `TODO(phase-8)`, no `TEMPORARILY DISABLED` text remains in test.yml.

## Deviations from Plan

### Auto-noted (not deviations)

**verify.fat-skills absent from regenerated TS artifact**
- Found during: Task 1
- This is correct behavior: the generator is manifest-driven and `verify.fat-skills` no longer exists in the manifest files. The old committed artifact was stale. The check script validated the new output is correct.
- This is not a deviation — it is the intended function of the generator rewrite (produce correct output from manifests).

No other deviations.

## Known Stubs

None.

## Threat Flags

None — build-tool and CI-config change only, no trust boundaries.

## Self-Check: PASSED

Files exist:
- FOUND: sdk/scripts/gen-command-aliases.ts
- FOUND: sdk/src/query/command-aliases.generated.ts
- FOUND: get-shit-done/bin/lib/command-aliases.generated.cjs
- FOUND: .github/workflows/test.yml

Commits exist:
- FOUND: 4ca78021 (Task 1)
- FOUND: 799b1ae2 (Task 2)

Verification:
- check-command-aliases-fresh.mjs: PASS
- No `if: false` in .github/workflows/: PASS
