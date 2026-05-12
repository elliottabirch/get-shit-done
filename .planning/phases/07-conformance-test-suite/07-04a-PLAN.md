<!-- leak-grep-allow file — generated PLAN.md artifact; @.planning/* context refs are consumed by executor via SDK, not auto-loaded by skills -->
---
phase: 07-conformance-test-suite
plan: 04a
type: execute
wave: 2
depends_on: [02, 03]
files_modified:
  - package.json
  - tests/conformance/paired.test.ts
  - .github/workflows/test.yml
  - vitest.conformance.config.ts
autonomous: false
requirements: [CONFORM-01, CONFORM-03]
tags: [conformance, paired, ci, bd-install]

user_setup:
  - service: bd
    why: "BeadsAdapter paired conformance requires bd v1.0.4+ CLI locally (skip-with-warning fallback) and on CI (hard requirement per D-03)"
    cli_install:
      - task: "Confirm local bd v1.0.4+ installed"
        location: "Developer machine: `bd --version` should print >= 1.0.4"
        fallback: "If absent, paired tests skip locally with a warning (D-03); they fail only on CI"
  - service: github-actions
    why: "CI must install bd before running paired conformance on PR"
    dashboard_config:
      - task: "Confirm bd release org (Assumption A1)"
        location: "Checkpoint:decision task BEFORE Task 5 — user names the GitHub org that ships bd releases; CI workflow substitutes the locked value"

must_haves:
  truths:
    - "Fork `package.json` devDeps include `gsd-beads: file:../gsd-beads` (D-02)."
    - "Fork `package.json` scripts include `test:conformance:paired` invoking paired.test.ts + meta-coverage (later plans add write-*.ts / properties / failure-injection)."
    - "`tests/conformance/paired.test.ts` invokes `runAdapterConformanceSuite` twice (markdown, beads) with bd-presence probe + skip-with-warning (D-01, D-03)."
    - "`.github/workflows/test.yml` has a bd install step (Ubuntu tarball + macOS Homebrew) + a sibling checkout step + a `test:conformance:paired` invocation; the bd release org is locked via the checkpoint:decision task (Assumption A1 resolution)."
    - "Running `npm run test:conformance:paired` locally with bd present → MarkdownAdapter + BeadsAdapter baseline harness green on both; without bd → markdown green + beads describe.skip with clear warning."
  artifacts:
    - path: "tests/conformance/paired.test.ts"
      provides: "Paired harness entry point — D-01"
      contains: "runAdapterConformanceSuite"
    - path: ".github/workflows/test.yml"
      provides: "CI with bd install + paired conformance run"
      contains: "bd --version"
    - path: "package.json"
      provides: "devDep file:../gsd-beads + test:conformance:paired script"
      contains: "gsd-beads"
  key_links:
    - from: "tests/conformance/paired.test.ts"
      to: "tests/conformance/adapter.conformance.ts"
      via: "imports runAdapterConformanceSuite"
      pattern: "runAdapterConformanceSuite"
    - from: "tests/conformance/paired.test.ts"
      to: "gsd-beads/testing (node_modules via file:../gsd-beads)"
      via: "imports createBeadsAdapter"
      pattern: "from 'gsd-beads/testing'"
---

<objective>
Wire the fork to the sibling and activate the paired conformance harness
invocation (split from original 07-04; follow-up plan 07-04b migrates
write-*.ts files and populates manifest entries).

Three outcomes:

1. **Fork devDep + vitest config**: Add `gsd-beads: file:../gsd-beads` to
   fork devDeps per D-02; add `test:conformance:paired` script listing
   paired.test.ts + meta-coverage.test.ts; confirm the vitest conformance
   config picks up paired.test.ts.

2. **Paired harness entry point**: `tests/conformance/paired.test.ts`
   invokes `runAdapterConformanceSuite` twice (markdown, beads) with a
   local bd-presence probe that skips-with-warning when bd is absent
   (developer convenience per D-03).

3. **CI bd install + paired run**: bd release org is confirmed via a
   blocking `checkpoint:decision` task (Assumption A1 resolution);
   `.github/workflows/test.yml` gains Ubuntu-tarball + macOS-Homebrew
   install steps, a sibling checkout step, and a `test:conformance:paired`
   invocation gated on Linux matrix slot. Post-checkpoint human-verify
   confirms local + CI both green.

Purpose: CONFORM-01 SC#1 baseline (both adapters run the locked Phase 1
harness). The 16-case StateWriteOutcome matrix migration + manifest
population ships in 07-04b (split for scope sanity per review blocker
#2).

Output: `npm run test:conformance:paired` runs baseline harness tests on
both adapters locally (with bd) AND on fork CI. Downstream plans 07-04b
/ 07-05a / 07-05b / 07-06 can now extend the script list with additional
test files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/07-conformance-test-suite/07-CONTEXT.md
@.planning/phases/07-conformance-test-suite/07-RESEARCH.md
@.planning/phases/07-conformance-test-suite/07-PATTERNS.md
@tests/conformance/adapter.conformance.ts
@tests/conformance/markdown.conformance.test.ts
@tests/conformance/manifest.ts
@tests/conformance/test-registry.ts
@adapters/types.ts

<interfaces>
<!-- Locked Phase 1 D-15 harness signature (from tests/conformance/adapter.conformance.ts): -->
export function runAdapterConformanceSuite(
  adapterName: string,
  adapterFactory: (projectDir: string) => StorageAdapter,
): void;

<!-- Phase 7 Plan 07-03 sibling export (resolves once file:../gsd-beads devDep installs): -->
import { createBeadsAdapter } from 'gsd-beads/testing';
// createBeadsAdapter: (projectDir: string) => BeadsAdapter
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fork devDeps + test:conformance:paired script + vitest config glob</name>
  <files>package.json, vitest.conformance.config.ts</files>
  <read_first>
    - /Volumes/code/get-shit-done/package.json (lines 58-100 — devDeps + scripts + exports)
    - /Volumes/code/gsd-beads/package.json (lines 44-50 — sibling's existing file-link devDep for pattern reference)
    - /Volumes/code/get-shit-done/vitest.conformance.config.ts (existing config — identify the `include` glob pattern to confirm it will pick up paired.test.ts automatically, or extend if needed)
    - /Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-RESEARCH.md (lines 281-285 install commands; lines 1448-1465 test-map runtime budget)
  </read_first>
  <action>
    1. **Edit `package.json`** — devDeps: add `gsd-beads` alongside existing `c8`:
       ```json
         "devDependencies": {
           "c8": "^11.0.0",
           "gsd-beads": "file:../gsd-beads"
         },
       ```
       Note: Plan 07-05a adds `fast-check` + `@fast-check/vitest`; do NOT add them here.

    2. **Edit `package.json`** — scripts: add `test:conformance:paired` right after the existing `test:conformance` line. This plan ships the baseline (paired + meta-coverage); 07-04b, 07-05b, 07-06 extend the file list incrementally:
       ```json
           "test:conformance": "NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run --config vitest.conformance.config.ts",
           "test:conformance:paired": "NODE_PATH=./sdk/node_modules ./sdk/node_modules/.bin/vitest run --config vitest.conformance.config.ts tests/conformance/paired.test.ts tests/conformance/meta-coverage.test.ts",
       ```

    3. Run `npm install` (do NOT use `--force`). This resolves `file:../gsd-beads` against the sibling working tree. Expected: sibling's current `dist/testing/conformance-factory.js` becomes available at `node_modules/gsd-beads/dist/testing/conformance-factory.js`. If install fails, confirm Plan 07-03 shipped + sibling `npm run build` was run.

    4. Verify the subpath resolves: `node -e "import('gsd-beads/testing').then(m => console.log(typeof m.createBeadsAdapter))"` — should print `function`.

    5. **Edit `vitest.conformance.config.ts`**: Read the file. Current `include` pattern likely covers `tests/conformance/**/*.test.ts`. Confirm it picks up `paired.test.ts` (it will if the glob is broad). If it's narrower, extend to include `paired.test.ts`. Do NOT change `testTimeout` in this plan — Plan 07-05a raises it for property tests.
  </action>
  <verify>
    <automated>npm install &amp;&amp; node -e "import('gsd-beads/testing').then(m => { if (typeof m.createBeadsAdapter !== 'function') throw new Error('subpath broken'); })" &amp;&amp; grep -c "test:conformance:paired" package.json | grep -v '^0$' &amp;&amp; grep -c "gsd-beads.*file" package.json | grep -v '^0$'</automated>
  </verify>
  <done>
    - `npm install` completes without errors; `node_modules/gsd-beads/dist/testing/conformance-factory.js` exists.
    - `test:conformance:paired` script runs vitest over paired.test.ts + meta-coverage.test.ts.
    - Dynamic import of `gsd-beads/testing` returns `{ createBeadsAdapter: [Function] }`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Author paired.test.ts with bd presence probe + skip-with-warning</name>
  <files>tests/conformance/paired.test.ts</files>
  <read_first>
    - /Volumes/code/get-shit-done/tests/conformance/markdown.conformance.test.ts (all 7 LOC — consumer pattern, import syntax, harness invocation shape)
    - /Volumes/code/get-shit-done/tests/conformance/adapter.conformance.ts (all 89 LOC — locked signature; confirm harness handles two invocations correctly)
    - /Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-RESEARCH.md (lines 524-557 Pattern 2 paired invocation with bd probe)
    - /Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-PATTERNS.md (lines 56-99 paired.test.ts shape)
  </read_first>
  <behavior>
    - Test-level behavior: when bd v1.0.4+ is present locally, `runAdapterConformanceSuite('beads', ...)` executes; its describes + its blocks run against BeadsAdapter; getRecord round-trip + stat tests pass.
    - When bd is absent, the file registers a single `describe.skip('StorageAdapter conformance: beads', ...)` block with an informative test name. Developer sees the gap; CI hard-requires bd installed so this path never triggers there.
    - `runAdapterConformanceSuite('markdown', ...)` always runs.
  </behavior>
  <action>
    **Create `tests/conformance/paired.test.ts`** with exactly this content:
    ```typescript
    /**
     * Phase 7 Plan 07-04a: paired conformance harness invocation (D-01 + D-03).
     *
     * Runs the locked Phase 1 D-15 `runAdapterConformanceSuite` harness once
     * per adapter. Single authoritative CI surface for SC#1 "zero failing
     * assertions across both adapters" (D-01).
     *
     * bd v1.0.4+ presence probe (D-03):
     *   - LOCAL: skip-with-warning if bd is absent (developer convenience).
     *   - CI:    bd install step in .github/workflows/test.yml guarantees
     *            presence; describe.skip path never triggers on CI.
     *
     * Runtime budget per RESEARCH §Test Infrastructure: ~30-60s including
     * BeadsAdapter cold-start ~400-700ms per test.
     *
     * 07-04b will add imports for runStateWriteOutcomeSuite /
     * runStateEventDispatchSuite / runWithTransactionSuite at the bottom
     * of this file plus a per-adapter loop that invokes them. Keep the
     * structure loop-ready now (a NOUN/adapter-tuple array pattern) so
     * that the 07-04b diff is purely additive.
     */
    import { describe, it } from 'vitest';
    import { spawnSync } from 'node:child_process';
    import { runAdapterConformanceSuite } from './adapter.conformance.js';
    import { MarkdownAdapter } from '../../adapters/markdown/index.js';
    import { createBeadsAdapter } from 'gsd-beads/testing';
    import type { StorageAdapter } from '../../adapters/types.js';

    /** Probe bd CLI. Returns true iff bd >= v1.0.4 is on PATH. */
    export function bdPresent(): boolean {
      const r = spawnSync('bd', ['--version'], { encoding: 'utf-8' });
      if (r.status !== 0) return false;
      // bd v1.0.4 / v1.0.5 / ... prints `bd version 1.0.X (<provenance>)`.
      // Accept 1.0.4 through 1.0.x; reject 1.0.0-1.0.3 (missing required primitives).
      return /^bd version 1\.0\.(4|[5-9]|\d{2,})\b/.test(r.stdout ?? '');
    }

    /** Adapter tuple used by 07-04b's migrated-suite loop; exported now to keep 07-04b additive. */
    export type AdapterFactory = (projectDir: string) => StorageAdapter;
    export const pairedAdapters: Array<[string, AdapterFactory]> = [
      ['markdown', (projectDir) => new MarkdownAdapter(projectDir)],
    ];
    if (bdPresent()) {
      pairedAdapters.push(['beads', createBeadsAdapter]);
    }

    // MarkdownAdapter — always runs via the locked harness.
    runAdapterConformanceSuite(
      'markdown',
      (projectDir) => new MarkdownAdapter(projectDir),
    );

    // BeadsAdapter — runs if bd is present locally; skip-with-warning otherwise.
    if (bdPresent()) {
      runAdapterConformanceSuite('beads', createBeadsAdapter);
    } else {
      describe.skip('StorageAdapter conformance: beads', () => {
        it.skip(
          'bd v1.0.4+ not available — install bd locally to run paired conformance ' +
            '(CI installs bd; this skip is developer convenience per D-03)',
          () => {},
        );
      });
    }
    ```
  </action>
  <verify>
    <automated>npm run test:conformance:paired -- tests/conformance/paired.test.ts</automated>
  </verify>
  <done>
    - `tests/conformance/paired.test.ts` exists + imports compile.
    - When bd is present locally, both `StorageAdapter conformance: markdown` AND `...: beads` describes emit test output (visible in vitest reporter).
    - When bd is absent, markdown describe runs; beads describe shows as skipped with the warning.
    - `bdPresent` + `pairedAdapters` are exported (consumed by 07-04b).
  </done>
</task>

<task type="checkpoint:decision" gate="blocking">
  <name>Checkpoint: Confirm bd release GitHub org (Assumption A1 resolution)</name>
  <decision>
    What is the canonical GitHub org + repo slug that ships bd release tarballs?
    Task 5 below writes a `.github/workflows/test.yml` step that downloads
    `https://github.com/<bd-org>/beads/releases/download/v1.0.4/bd-linux-amd64.tar.gz`.
    The `<bd-org>` placeholder MUST be replaced with the real org before CI
    can run.
  </decision>
  <context>
    RESEARCH.md § bd install CI Patterns and Assumption A1 flag the release
    URL template as MEDIUM-confidence. The URL shape follows the standard
    GitHub release-tarball convention, but the research did NOT fetch the
    actual release list. Task 5 (CI workflow) is the first point where a
    wrong value would cause CI failure, so this decision is elevated to a
    blocking checkpoint rather than left as a follow-up editorial fix.

    Local developer evidence (`/opt/homebrew/bin/bd`, `bd version 1.0.4
    (Homebrew)`) confirms bd is Homebrew-distributable but does not reveal
    the upstream GitHub org. Candidates seen in research: `beads-dev`,
    `<bd-org>` (placeholder only), unknown.

    Do NOT guess. Block Task 5 until the developer provides the confirmed
    org name.
  </context>
  <options>
    <option id="option-a">
      <name>Provide the confirmed bd release org</name>
      <pros>Task 5 writes a fully valid CI workflow; first PR CI run succeeds on the bd install step.</pros>
      <cons>Requires the developer to run `curl -I` against a candidate URL or consult bd's README.</cons>
    </option>
    <option id="option-b">
      <name>Pin install to Homebrew (macOS-only) for first CI landing; defer Linux tarball</name>
      <pros>Ships CI without needing the Linux release URL today.</pros>
      <cons>Linux is the primary CI matrix slot; macOS-only CI means every PR effectively bypasses the paired bd suite on the main path. Rejected unless the developer explicitly chooses this as a stop-gap.</cons>
    </option>
  </options>
  <resume-signal>
    Reply with: `org=<the-github-org>` (for example `org=beads-dev`) to
    unblock Task 5, OR reply `option-b` to accept the macOS-only stop-gap.
    Do NOT proceed without one of these responses.
  </resume-signal>
</task>

<task type="auto">
  <name>Task 5: GitHub Actions CI — bd install step + sibling checkout + paired suite (number kept from original plan for continuity; Tasks 3-4 moved to Plan 07-04b)</name>
  <files>.github/workflows/test.yml</files>
  <read_first>
    - /Volumes/code/get-shit-done/.github/workflows/test.yml (full file — pinned action SHAs, matrix strategy, existing Node version handling + install steps)
    - /Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-RESEARCH.md (lines 1336-1401 CI install patterns; lines 1619 Assumption A1 about bd release URL)
    - /Volumes/code/get-shit-done/.planning/phases/07-conformance-test-suite/07-PATTERNS.md (lines 847-895 workflow additions)
  </read_first>
  <action>
    Use the bd release org confirmed in the checkpoint above. Substitute it for `<bd-org>` verbatim in the commands below.

    1. **Edit `.github/workflows/test.yml`**: Find the job that runs tests (likely `test:` or similar). Before the `Install dependencies` step, add:
       ```yaml
       - name: Install bd (Linux release tarball)
         if: runner.os == 'Linux'
         run: |
           set -euo pipefail
           BD_VERSION=1.0.4
           BD_URL="https://github.com/<bd-org>/beads/releases/download/v${BD_VERSION}/bd-linux-amd64.tar.gz"
           curl -fL -o /tmp/bd.tar.gz "$BD_URL"
           sudo tar -xzf /tmp/bd.tar.gz -C /usr/local/bin
           bd --version  # CI gate: fails job if install botched

       - name: Install bd (macOS Homebrew)
         if: runner.os == 'macOS'
         run: |
           brew install bd || brew upgrade bd
           bd --version
       ```

    2. Add a sibling-checkout step before the paired test run (uses existing `actions/checkout` pinned SHA from the top of the workflow file — mirror that pin):
       ```yaml
       - name: Checkout sibling gsd-beads
         uses: actions/checkout@<existing-pinned-sha>  # match the SHA already pinned in this workflow for actions/checkout
         with:
           repository: <org>/gsd-beads
           path: ../gsd-beads
           ref: main

       - name: Build sibling gsd-beads
         working-directory: ../gsd-beads
         run: |
           npm ci
           npm run build
       ```
       `<org>/gsd-beads` — use the actual GitHub org. If the fork's existing workflow references another repo, mirror that pattern.

    3. Add a paired-conformance step (runs only when bd is present; place AFTER the existing `Install dependencies` step):
       ```yaml
       - name: Run paired conformance
         if: runner.os == 'Linux' && matrix.node-version == '22'   # adjust to match existing matrix; run paired on one matrix slot to keep CI time bounded
         run: npm run test:conformance:paired
       ```

    4. Confirm the workflow file parses as valid YAML. Do NOT modify action SHA pins, the matrix config, or unrelated steps.

    5. Commit message should record the confirmed bd release org from the checkpoint so the reviewer has the Assumption A1 trail.
  </action>
  <verify>
    <automated>python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/test.yml'))" &amp;&amp; grep -c "bd --version" .github/workflows/test.yml | grep -v '^0$' &amp;&amp; grep -c "test:conformance:paired" .github/workflows/test.yml | grep -v '^0$'</automated>
  </verify>
  <done>
    - Workflow YAML parses cleanly.
    - Steps present for: bd install on Linux, bd install on macOS, sibling checkout, sibling build, paired conformance run.
    - Existing steps + pinned SHAs unchanged (visible in `git diff .github/workflows/test.yml`).
    - The confirmed bd release org from the checkpoint is recorded in the commit message.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Checkpoint: CI workflow runs green on bd install + baseline paired suite</name>
  <what-built>
    - Fork devDeps include file:../gsd-beads.
    - paired.test.ts invokes both adapters through the locked harness with bd skip-with-warning.
    - CI workflow has bd install + sibling checkout + paired test step gated on the Linux matrix slot.
  </what-built>
  <how-to-verify>
    1. **Locally**: `bd --version` prints 1.0.4+; `npm run test:conformance:paired` green (baseline harness on both adapters + meta-coverage).
    2. Push a small test branch to GitHub; observe PR CI:
       - bd install step succeeds on Ubuntu runner.
       - sibling checkout succeeds.
       - `npm run test:conformance:paired` completes with all green.
    3. Record wall-clock runtime of the first successful CI paired run in the plan summary — it becomes the baseline for 07-04b / 07-05a / 07-05b / 07-06 to measure regression against.
  </how-to-verify>
  <resume-signal>
    Type "approved" when local + CI runs are both green. If CI fails on the bd install step despite the confirmed org, diagnose before proceeding — the URL template may require an additional path segment.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| fork CI → GitHub release server | HTTPS download of bd tarball; no secrets; checksum-unverified (mitigation below) |
| fork → sibling via file:../gsd-beads | local file-link; works only when both repos are checked out alongside |
| paired.test.ts spawn → bd CLI | subprocess; BEADS_ACTOR=seed env isolation (inherited from sibling factory) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-04a-01 | Tampering | bd tarball download in CI | accept | GitHub releases HTTPS; TLS verifies origin; checksum pinning deferred (low priority — bd is a dev-tool dep, not a runtime dep; if supply-chain concern materializes, add SHA256 pin in a follow-up). |
| T-07-04a-02 | Denial of Service | CI runtime with bd install + baseline paired suite | mitigate | bd install ~5-10s; baseline paired suite ~30s; total CI delta ≈ 40s. Optional caching deferred per RESEARCH recommendation. |
| T-07-04a-03 | Spoofing | `bd --version` probe accepting regex `^bd version 1\.0\.(4|[5-9]...)` | accept | Probe only gates test-run execution; cannot be exploited to bypass conformance (no privilege elevation path). |
| T-07-04a-04 | Tampering | `file:../gsd-beads` devDep | accept | Both repos under developer control; sibling's working tree is the single source of truth; drift surfaces in paired tests. |
</threat_model>

<verification>
Combined after all tasks + checkpoints:
- `npm run test:conformance:paired` green locally with bd installed
  (baseline harness + meta-coverage).
- CI run on a throwaway branch: bd install step succeeds + baseline
  paired suite green on Ubuntu matrix slot.
- Assumption A1 (bd release URL) resolved at the checkpoint:decision
  task; captured in commit message of the CI workflow change.
</verification>

<success_criteria>
- Baseline paired conformance is wired end-to-end: dev + CI.
- bd release org is locked data, not a `<bd-org>` placeholder.
- Plan 07-04b can extend `test:conformance:paired` with migrated
  write-*.ts suite imports; Plans 07-05a/b and 07-06 further extend
  with property and failure-injection tests.
</success_criteria>

<output>
After completion, create `.planning/phases/07-conformance-test-suite/07-04a-SUMMARY.md`
documenting:
- The confirmed bd release org from the checkpoint:decision task.
- CI runtime delta measured on the first successful paired run (baseline
  for downstream plans).
- Exact `test:conformance:paired` script value committed (used as the
  diff-base by 07-04b / 07-05a / 07-05b / 07-06 when they extend the
  file list).
- Forward pointer: Plan 07-04b migrates write-*.test.ts files into the
  harness + populates manifest with ≥30 entries (StateWriteOutcome + 9
  section-tuple + baseline binB).
</output>
