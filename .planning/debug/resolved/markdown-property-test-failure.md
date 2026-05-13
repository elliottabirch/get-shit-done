---
status: resolved
trigger: "Diagnose and fix 12 failing MarkdownAdapter property tests in tests/conformance/properties.test.ts"
created: 2026-05-12T00:00:00Z
updated: 2026-05-12T00:10:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "adapters/dist/markdown/index.js was stale (built before normalize() was added in commit a9a0f4ba). In vitest singleFork pool mode, the barrel file (adapters/markdown/index.js) re-exports from ../dist/markdown/index.js. The vitest alias for adapters/markdown/index.js -> index.ts is bypassed for the dist re-export path, causing the stale dist (missing normalize()) to be loaded. normalize() is then not a function, fast-check reports the property as failed."
  confirming_evidence:
    - "Prototype keys at runtime: normalizeMd present, normalize absent — consistent with dist (not source) being loaded"
    - "adapter.normalize is not a function error thrown inside fc.asyncProperty — fast-check reports this as a property failure with shrink 0"
    - "After dist rebuild with tsc, normalize appears on prototype and all markdown property tests run for full 60s budget (passing)"
    - "BeadsAdapter tests pass because createBeadsAdapter comes from gsd-beads package, not the local dist"
  falsification_test: "After adding alias for adapters/dist/markdown/index.js in vitest config, tests must still pass even with stale dist"
  fix_rationale: "Add second alias entry for dist path so vitest always redirects dist imports to TypeScript source regardless of whether dist is stale"
  blind_spots: "Why exactly the existing barrel alias did not intercept the dist re-export in singleFork mode"
next_action: "DONE - fix committed"

## Symptoms

expected: "All 12 markdown property tests pass (getRecord === normalize(encode(value)))"
actual: "All 12 markdown property tests fail on first iteration, shrunk 0 times"
errors: "TypeError: adapter.normalize is not a function (thrown inside fc.asyncProperty; fast-check reports as 'Property failed after 1 tests, Shrunk 0 time(s)')"
reproduction: "npm run test:conformance:paired tests/conformance/properties.test.ts"
started: "After 07-05b commit b4317e63 (property test wiring); normalize() added in 07-01 commit a9a0f4ba but dist not rebuilt"

## Eliminated

- hypothesis: "The test wired adapter-branching condition backwards (if markdown calls normalize() on wrong side)"
  evidence: "Test logic is correct - rawBody = encode(value), body = normalize(rawBody), putRecord(path, body), retrieved = getRecord(path), expected = normalize(body). For markdown (identity normalize) this is trivially correct."
  timestamp: 2026-05-12T00:03:00Z

- hypothesis: "The round-trip has a string transformation (trailing newline, BOM, etc.)"
  evidence: "The failure is adapter.normalize is not a function - not a string mismatch. The method itself is missing from the prototype."
  timestamp: 2026-05-12T00:04:00Z

- hypothesis: "Path resolution drift between putRecord and getRecord"
  evidence: "The failure happens before any putRecord/getRecord call - adapter.normalize() is called first and throws."
  timestamp: 2026-05-12T00:04:00Z

## Evidence

- timestamp: 2026-05-12T00:03:00Z
  checked: "adapters/dist/markdown/index.js for public normalize() method"
  found: "grep 'normalize(' dist: no matches for public normalize; only normalizeMd (private helper). Dist was built before commit a9a0f4ba added normalize() to MarkdownAdapter."
  implication: "Dist is stale. Something in the module loading chain loads dist instead of TypeScript source."

- timestamp: 2026-05-12T00:03:00Z
  checked: "adapters/markdown/index.js barrel content"
  found: "export { MarkdownAdapter } from '../dist/markdown/index.js'; - This barrel re-exports from dist."
  implication: "When vitest's singleFork pool loads index.js, if the barrel alias doesn't intercept, it executes and loads the stale dist."

- timestamp: 2026-05-12T00:04:00Z
  checked: "Runtime prototype of MarkdownAdapter instance in debug test"
  found: "normalizeMd in prototype, normalize NOT in prototype. confirms dist (not source ts) is being instantiated."
  implication: "The vitest alias for adapters/markdown/index.js is not intercepting the barrel's re-export of ../dist/markdown/index.js."

- timestamp: 2026-05-12T00:05:00Z
  checked: "After tsc rebuild of adapters dist"
  found: "adapters/dist/markdown/index.js line 847: normalize(body, _category) { return body; } - dist now has normalize"
  implication: "After rebuild: normalize in prototype, tests pass (run for full 60s budget)."

## Resolution

root_cause: "adapters/dist/markdown/index.js was stale — built before normalize() was added to MarkdownAdapter (commit a9a0f4ba). The vitest conformance config's alias for adapters/markdown/index.js -> index.ts does not intercept the barrel's re-export path (../dist/markdown/index.js). In singleFork pool mode, the stale dist is loaded, adapter.normalize is not a function, and fc.asyncProperty throws on first invocation — fast-check reports this as a property failure."
fix: "1. Add a second alias in vitest.conformance.config.ts mapping adapters/dist/markdown/index.js -> adapters/markdown/index.ts, so vitest always uses the TypeScript source regardless of dist staleness. 2. Rebuild adapters dist (tsc) to bring it into sync for local dev."
verification: "Single-test runs of markdown property tests take 10+ seconds (full time budget) after fix — previously failed in 1-8ms."
files_changed: ["vitest.conformance.config.ts"]
