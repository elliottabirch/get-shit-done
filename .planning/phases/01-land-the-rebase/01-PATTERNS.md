# Phase 1: Land the rebase - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 4
**Analogs found:** 3 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/baseline-diff.cjs` | utility | transform (set-difference of two JSON test reports) | `scripts/diff-touches-shipped-paths.cjs` | role-match |
| `scripts/cherry-pick-audit.cjs` (or inline commands) | utility | batch (git commit walk + diff classification) | `scripts/audit-context-blocks.cjs` | role-match |
| `.planning/phases/01-land-the-rebase/01-REVIEW-NOTES.md` | artifact (markdown) | N/A (human-written) | `.planning/archived-milestone/v1.0/phases/03-wire-core-write-methods-recordstateevent/03-REVIEW.md` | exact |
| `.planning/phases/01-land-the-rebase/upstream-baseline-failures.txt` (or .json) | data artifact | N/A (vitest JSON output + node extraction) | None — new artifact class | no analog |

---

## Pattern Assignments

### `scripts/baseline-diff.cjs` (utility, transform)

**Analog:** `scripts/diff-touches-shipped-paths.cjs`

**Closest match rationale:** Both scripts receive structured input (stdin paths vs JSON file paths), apply a classification/filtering transform, and exit with a numeric code encoding the result. The set-difference logic (two sorted ID lists → comm -23 style output) is novel but the script scaffolding — shebang, `'use strict'`, named exit codes, `process.on('uncaughtException')` guard, `require.main === module` check, `module.exports` for testability — is the established project pattern for CJS utility scripts.

**Imports pattern** (`scripts/diff-touches-shipped-paths.cjs` lines 44-46):
```javascript
'use strict';

const fs = require('node:fs');
const path = require('node:path');
```

**Named exit codes pattern** (`scripts/diff-touches-shipped-paths.cjs` lines 47-49):
```javascript
const EXIT_SHIPPED = 0;
const EXIT_NOT_SHIPPED = 1;
const EXIT_ERROR = 2;
```
For `baseline-diff.cjs`, translate to:
```javascript
const EXIT_PASS = 0;      // |new failures| <= 2
const EXIT_FAIL = 1;      // |new failures| >= 3  → block Phase 1
const EXIT_ERROR = 2;     // bad input / I/O failure
```

**Error guard pattern** (`scripts/diff-touches-shipped-paths.cjs` lines 97-101):
```javascript
function fail(message, err) {
  process.stderr.write(`diff-touches-shipped-paths: ${message}\n`);
  if (err && err.stack) process.stderr.write(`${err.stack}\n`);
  process.exit(EXIT_ERROR);
}

function main() {
  process.on('uncaughtException', (err) => fail('uncaught exception', err));
  process.on('unhandledRejection', (err) => fail('unhandled rejection', err));
  ...
}

if (require.main === module) {
  main();
}

module.exports = { ... };
```

**Core transform pattern** (`scripts/diff-touches-shipped-paths.cjs` lines 75-82 — isShipped predicate; adapt to set-difference):
The analog uses prefix matching. For `baseline-diff.cjs`, the core operation is:
```javascript
// Parse two vitest JSON files; extract failing test IDs as sorted arrays;
// subtract allowed set (upstream baseline + inherited-skip); count remainder.
// Vitest JSON shape (from RESEARCH.md):
//   r.testResults[].assertionResults[].status === 'failed'
//   stable ID = f.name + '::' + a.fullName
function extractFailingIds(jsonPath) {
  const r = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const ids = new Set();
  for (const f of r.testResults) {
    for (const a of f.assertionResults) {
      if (a.status === 'failed') ids.add(f.name + '::' + a.fullName);
    }
  }
  return ids;
}
```

**Stdout/stderr discipline pattern** (`scripts/diff-touches-shipped-paths.cjs` lines 91-94):
```javascript
// Findings always go to stdout (structured); errors always go to stderr.
process.stderr.write(`diff-touches-shipped-paths: ${message}\n`);
process.stdout.write(`ok: ...\n`);
```

**CLI arguments pattern** (`scripts/gen-inventory-manifest.cjs` lines 73-74):
```javascript
const [, , flag] = process.argv;
// or for multiple positional args:
const [, , upstreamJsonPath, rebranJsonPath, ...rest] = process.argv;
```

---

### `scripts/cherry-pick-audit.cjs` (utility, batch) — or inline commands

**Analog:** `scripts/audit-context-blocks.cjs`

**Closest match rationale:** Both scripts walk a set of items (files vs git commits), classify each item into a small enum of dispositions, and emit a structured report. The cherry-pick audit walks commits unique to `origin/feat/storage-adapter`, attempts `cherry-pick --no-commit` on a scratch branch, and classifies the diff as `EMPTY | SUBSTANTIVE`. `audit-context-blocks.cjs` does the same structural walk+classify+report pattern.

**Note:** RESEARCH.md (§"Cherry-Pick Dry-Run Audit") documents that the audit is effectively pre-answered (1 substantive missing commit identified). The planner may choose to implement this as inline bash commands rather than a standalone script. If a script is created, use the patterns below.

**Imports pattern** (`scripts/audit-context-blocks.cjs` lines 31-36):
```javascript
'use strict';

const fs = require('node:fs');
const path = require('node:path');
```

**Disposition enum pattern** (`scripts/audit-workflow-script-paths.cjs` lines 19-22):
```javascript
const AUDIT_FINDING = Object.freeze({
  MISSING_FROM_REPO: 'missing_from_repo',
  NOT_INSTALLED: 'not_installed',
});
```
For cherry-pick audit, translate to:
```javascript
const COMMIT_CLASS = Object.freeze({
  ALREADY_PRESENT:  'already_present',   // empty diff after cherry-pick --no-commit
  MERGE_COMMIT:     'merge_commit',       // skip — cherry-pick -m not applicable
  SUBSTANTIVE:      'substantive',        // non-empty diff — flag for explicit decision
  INTENTIONAL_DROP: 'intentional_drop',  // documented in DELTA.md
});
```

**Walk + classify + report pattern** (`scripts/audit-context-blocks.cjs` lines 56-68, walk; lines 74-107, classify):
```javascript
function classify(file, ref) {
  // Disposition logic — discrete bucket per item.
  if (...) return { bucket: 'EXCEPTION', rationale: '...' };
  return { bucket: 'INTERCEPT-CANDIDATE', rationale: 'default' };
}
```

**Markdown report generation pattern** (`scripts/audit-context-blocks.cjs` lines 143-183):
```javascript
function renderMarkdown(records) {
  const lines = [
    '# Title',
    '',
    `**Generated:** ${new Date().toISOString().slice(0, 10)}`,
    ...
    '| # | Commit | Subject | Class | Notes |',
    '|---|--------|---------|-------|-------|',
    ...records.map((r, i) => `| ${i + 1} | \`${r.sha}\` | ${r.subject} | ${r.class} | ${r.notes} |`),
  ];
  return lines.join('\n');
}
```

**File write pattern** (`scripts/audit-context-blocks.cjs` lines 222-225):
```javascript
fs.mkdirSync('.planning/phases/01-land-the-rebase', { recursive: true });
fs.writeFileSync(outputPath, renderMarkdown(records));
process.stdout.write(`cherry-pick-audit: classified ${records.length} commit(s)\n`);
process.exit(0);
```

---

### `.planning/phases/01-land-the-rebase/01-REVIEW-NOTES.md` (artifact, markdown)

**Analog:** `.planning/archived-milestone/v1.0/phases/03-wire-core-write-methods-recordstateevent/03-REVIEW.md`

**Closest match rationale:** The analog is a code-review artifact produced after a Phase 3 implementation. Phase 1's REVIEW-NOTES.md is conceptually similar — a human-written verdict artifact — but its subject is a commit range (357 adapter commits) rather than source code diffs. Structure follows the same YAML frontmatter + section pattern.

**Frontmatter pattern** (`03-REVIEW.md` lines 1-28):
```yaml
---
phase: 01-land-the-rebase
reviewed: <ISO-8601 timestamp>
depth: spot-check-by-file-class
commits_reviewed: <count reviewed in full>
commits_sampled: <count sampled>
commits_total: 357
rebase_window: ae63cbe5..832df66b
findings:
  adapter_seam_surprises: 0        # count of unexpected changes in adapters/
  config_semantic_drift: 0         # count of quietly-changed config semantics
  flagged_for_followup: 0          # count requiring a bd issue or Phase 4 action
status: <clean | flagged>
---
```

**Section structure** (from D-14 in CONTEXT.md):
```markdown
# Phase 1: Diff Review — REVIEW-NOTES

## (a) File-class breakdown

| File class | Commits touching | Reviewed |
|------------|-----------------|---------|
| adapters/ (adapter seam) | 94 | all |
| sdk/src/ | XX | all (overlap with adapters/) |
| .planning/ (docs artifacts) | 214 | sampled |
| Test files | 65 | sampled |
| get-shit-done/ workflows | 13 | sampled |

## (b) Adapter-seam commit verdicts

(Every commit touching adapters/ or sdk/src/ — ~94 commits, one-line verdict each)

| SHA | Subject | Verdict |
|-----|---------|---------|
| ... | ... | clean / flag |

## (c) Sampled feature commit verdicts

| SHA | Subject | Verdict |
|-----|---------|---------|
| ... | ... | clean |

## (d) Flagged surprises

(Items that tests may not catch — config field semantic drift, error-message format changes, etc.)

### SURPRISE-01: ...
```

---

## Shared Patterns

### CJS Utility Script Scaffolding
**Source:** `scripts/diff-touches-shipped-paths.cjs` lines 1-7, 43-49, 91-101, 143-148
**Apply to:** `scripts/baseline-diff.cjs`, `scripts/cherry-pick-audit.cjs` (if implemented as a script)
```javascript
#!/usr/bin/env node
/**
 * <one-line description>
 * ...
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Named exit codes — always use named constants, not magic numbers
const EXIT_PASS  = 0;
const EXIT_FAIL  = 1;
const EXIT_ERROR = 2;

function fail(message, err) {
  process.stderr.write(`<script-name>: ${message}\n`);
  if (err && err.stack) process.stderr.write(`${err.stack}\n`);
  process.exit(EXIT_ERROR);
}

function main() {
  process.on('uncaughtException', (err) => fail('uncaught exception', err));
  process.on('unhandledRejection', (err) => fail('unhandled rejection', err));
  // ... main logic ...
}

if (require.main === module) {
  main();
}

module.exports = { /* named exports for testability */ };
```

### Vitest JSON ID Extraction (inline node one-liner)
**Source:** RESEARCH.md §"vitest Failing-Test-ID Extraction" (verified against `sdk/node_modules/vitest/dist/chunks/reporters.d.BFLkQcL6.d.ts`)
**Apply to:** Both the upstream-baseline capture task and the `scripts/baseline-diff.cjs` implementation
```javascript
// Stable test ID format: "<file-path>::<fullName>"
// where fullName = describe path + " > " + test name
const r = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const ids = [];
for (const f of r.testResults) {
  for (const a of f.assertionResults) {
    if (a.status === 'failed') ids.push(f.name + '::' + a.fullName);
  }
}
ids.sort();
```

### Set-Difference Evaluation (D-10 formula)
**Source:** RESEARCH.md §"Code Examples" — "Set-difference evaluation (D-10 gate formula)"
**Apply to:** `scripts/baseline-diff.cjs` core logic
```bash
# POSIX set-difference using comm (works on sorted newline-delimited files)
sort upstream-baseline-ids.txt inherited-skip-ids.txt | sort -u > allowed-failures.txt
comm -23 <(sort rebase-failures-ids.txt) allowed-failures.txt > new-failures.txt
UNCATEGORIZED=$(wc -l < new-failures.txt | tr -d ' ')
if [ "$UNCATEGORIZED" -le 2 ]; then echo "PASS"; else echo "FAIL"; fi
```
Or as a pure node implementation inside `baseline-diff.cjs`:
```javascript
function setDiff(a, b) {
  // Returns elements in Set a that are NOT in Set b
  return new Set([...a].filter(x => !b.has(x)));
}
const newFailures = setDiff(setDiff(rebranFailing, upstreamFailing), inheritedSkip);
```

### Markdown Artifact Frontmatter
**Source:** `.planning/archived-milestone/v1.0/phases/03-wire-core-write-methods-recordstateevent/03-REVIEW.md` lines 1-28
**Apply to:** `01-REVIEW-NOTES.md`

Use YAML frontmatter with machine-readable counts (`findings.X: N`) so future tooling can parse pass/fail state without reading prose. Status field must be one of a small enum (`clean | flagged`), not free text.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `upstream-baseline-failures.txt` (or `.json`) | data artifact | N/A | This is a one-shot vitest `--reporter=json` dump; no existing artifact of this type in `.planning/`. Format is determined by vitest's built-in JSON reporter, not project convention. Persist as JSON (raw vitest output) + a companion `-ids.txt` (newline-delimited stable IDs extracted via node one-liner per RESEARCH.md). |

---

## Metadata

**Analog search scope:** `scripts/` (all 28 files), `.planning/archived-milestone/v1.0/phases/` (REVIEW.md files), `.planning/todos/pending/` (inherited-skip list format)
**Files scanned:** 8 (run-tests.cjs, diff-touches-shipped-paths.cjs, audit-context-blocks.cjs, audit-workflow-script-paths.cjs, lint-no-source-grep.cjs, gen-inventory-manifest.cjs, 03-REVIEW.md, cjs-sdk-golden-parity-failures.md)
**Pattern extraction date:** 2026-05-17
