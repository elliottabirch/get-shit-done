# Phase 7: Conformance test suite - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-12
**Phase:** 07-conformance-test-suite
**Areas discussed:** Test-repo topology, Pairing enforcement mechanism, CONFORM-04 disposition, Property-based test strategy

---

## Test-repo topology

### Runner location

| Option | Description | Selected |
|--------|-------------|----------|
| Fork runs both | Fork adds gsd-beads as devDep; fork CI calls runAdapterConformanceSuite twice. Single authoritative surface for SC#1. Upstream rebase risk: new devDep visible to upstream. | ✓ |
| Sibling runs both | Sibling adds fork as devDep (already does). Sibling imports both adapters and runs paired. Fork stays thin. Zero new fork deps (best rebase posture). | |
| Each runs its own + separate parity job | Fork runs markdown; sibling runs beads; a third parity job runs paired comparison. Three distinct failure modes to diagnose. | |

**User's choice:** Fork runs both (Recommended)
**Notes:** Single authoritative CI surface for the SC#1 "zero failing assertions across both adapters" gate. Rebase risk framed as low — devDep is an adapter-seam change.

### Wiring shape

| Option | Description | Selected |
|--------|-------------|----------|
| file:../gsd-beads devDep | Mirror sibling's pattern: fork adds "gsd-beads": "file:../gsd-beads". Requires gsd-beads checkout alongside fork. Small rebase risk. | ✓ |
| Git submodule / monorepo-style | Submodule or npm workspace under fork. Heavier ceremony; better build-graph correctness. Larger rebase risk (workspaces config at root). | |
| Separate paired-conformance runner | No fork package.json change. CI orchestrates checkouts + runs via custom script. Lowest rebase risk; clunkier orchestration. | |

**User's choice:** file:../gsd-beads devDep (Recommended)
**Notes:** Mirrors sibling's existing file-link pattern; small rebase risk scoped to adapter seam.

### bd install

| Option | Description | Selected |
|--------|-------------|----------|
| CI installs bd from release binary | Fork CI pulls bd v1.0.4+ from releases (or brew on macOS). Paired tests skip if BD_VERSION missing (local dev). | ✓ |
| Vendor bd binary in fork | Commit pinned bd binary. Zero CI install; deterministic version. Bloat + license concerns. | |
| Paired tests skip if bd absent | Fork CI doesn't install bd; paired runs only when bd is present (local dev, manual, or nightly). | |

**User's choice:** CI installs bd from release binary (Recommended)
**Notes:** Standard CI pattern; `bd --version` probe before paired suite; skip-with-warning if absent locally.

### Factory location

| Option | Description | Selected |
|--------|-------------|----------|
| Import sibling's factory via subpath | Sibling exports factory from gsd-beads/testing. Single source of truth for bd init discipline (Landmines 9, 11). | ✓ |
| Fork authors its own factory | Fork duplicates bd init discipline. Two maintenance sites; drift risk. | |
| Shared fixture package | Extract factory to a published package. Overkill for v1.0; defer to post-v1.0. | |

**User's choice:** Import sibling's factory via `./testing` subpath (Recommended)
**Notes:** Landmine discipline encoded once; small sibling package.json exports addition.

### Sibling CI posture

| Option | Description | Selected |
|--------|-------------|----------|
| Consolidate to fork | Sibling deletes tests/conformance.test.ts. Fork is single conformance gate. Sibling keeps smoke/unit only. | ✓ |
| Keep both; fork paired + sibling standalone | Sibling retains standalone for fast iteration. Redundancy; drift risk. | |
| Fork paired + sibling triggers fork CI | Sibling CI dispatches fork conformance run on PR. Single authoritative source; cross-repo dispatch ceremony. | |

**User's choice:** Consolidate to fork (Recommended)
**Notes:** Two invocation sites is maintenance burden without benefit.

---

## Pairing enforcement mechanism

### Coverage enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Authored conformance manifest | Typed TS const CONFORMANCE_MANIFEST enumerating tuples; meta-test asserts describe-block-per-entry. Greppable, clear. | ✓ |
| Reflection over StorageAdapter interface | Runtime introspection. Automatic; brittle (TS types erased); can't reflect over heading anchors. | |
| Hybrid: manifest + reflection | Reflection for methods; manifest for tuples. Two layers; slight complexity. | |

**User's choice:** Authored conformance manifest (Recommended)
**Notes:** Matches sibling's D-04 enum-dispatch pattern; bidirectional coverage (entry ↔ test).

### Adapter-specific deviations

| Option | Description | Selected |
|--------|-------------|----------|
| Per-adapter `expected` annotation in manifest | Manifest entries carry {markdown, beads} expected outcomes. ADR citations in manifest. Explicit contract data. | ✓ |
| Capability-gated skip | Skip when adapter declares capability gap; loose guardrail for non-capability-gated deviations. | |
| Strict parity + adapter-override ADR list | Default identical; ADR-driven overrides read at runtime. Heaviest mechanism. | |

**User's choice:** Per-adapter `expected` annotation (Recommended)
**Notes:** D-2026-05-12-OQ06-CREATED-SECTION (BeadsAdapter never emits created_section under Outcome A) cited as canonical example.

### Section-tuple source

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-enumerated from canonical files | Review 12 canonical files + sibling state-event anchors. ~40–60 tuples. Authored once; grows manually. | |
| Derived from Phase 5 format module | Auto-scan format schemas + SDK updateSection calls. Drift-resistant; depends on schemas being complete (they aren't). | |
| Derived from actual usage grep | Grep adapter.updateSection/getSection call sites; extract string literals. Catches real usage; misses dynamic composition. | ✓ |

**User's choice:** Derived from actual usage grep
**Notes:** Mechanical; catches real usage patterns.

### Dynamic-anchor drift guard

| Option | Description | Selected |
|--------|-------------|----------|
| Fail on dynamic anchor grep pattern | CI warns on non-string-literal second args; rule: refactor to literal OR register manually with justification. | ✓ |
| Runtime trace during conformance | Instrument adapter during conformance; compare observed tuples vs manifest. ~50 LOC; catches dynamic composition. | |
| Accept some drift; quarterly audit | Grep catches literal case only; accepted gap; quarterly audit. Pragmatic; accepts risk. | |

**User's choice:** Fail on dynamic anchor grep pattern (Recommended)
**Notes:** Surfaces tradeoffs at PR time, not after the fact.

---

## CONFORM-04 disposition

### High-level disposition

| Option | Description | Selected |
|--------|-------------|----------|
| Document known-gap; ship Phase 7 anyway | BeadsAdapter Outcome A mid-replay gap formalized as `expected` deviation in manifest. Phase 6.1 addresses if priority surfaces. | ✓ |
| Block Phase 7 on Outcome B or C | Halt until atomic rollback ships. Clean matrix; Phase 7 delays by Phase 6.1 scope. | |
| Relax CONFORM-04 to 'rollback-semantics-documented' | Redefine contract; weakens §9 risk mitigation; strong ship argument. | |

**User's choice:** Document known-gap, ship Phase 7 anyway (Recommended)
**Notes:** Outcome A covers the typical usage path; gap is rare; formal manifest entry beats blocking v1.0 or weakening the contract.

### Failure injection mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Throw from inside withTransaction fn | User-level throw; real adapter surface; matches typical user code. Catches natural throw case. | ✓ |
| Adapter-injected failure mode | Test-only `__forceFailAfterNWrites` hook. Catches commit-replay path specifically; requires test-only adapter surface. | |
| Both | Two sub-cases; full coverage. | |

**User's choice:** Throw from inside withTransaction fn (Recommended)
**Notes:** Natural code path; no test-only API surface. D-09 known-gap documentation covers the commit-replay sub-case without needing adapter instrumentation.

### BeadsAdapter rollback check

| Option | Description | Selected |
|--------|-------------|----------|
| bd export --json diff | Pre/post snapshot `bd export --json`; assert equality modulo non-semantic metadata. BEADS_ACTOR=seed discipline gives byte-identity. | ✓ |
| List/count-based rollback check | `bd list --all --json` before == after. Simpler; misses subtle memory/comment drift. | |
| Adapter-mediated: readPlanningState diff | Adapter's own read surface; agnostic; may miss adapter-internal drift. | |

**User's choice:** bd export --json diff (Recommended)
**Notes:** Record-oriented equivalent to byte-identity on disk.

---

## Property-based test strategy

### Library/approach

| Option | Description | Selected |
|--------|-------------|----------|
| fast-check with per-record arbitraries | fast-check devDep; per-noun arbitrary files (~50–100 LOC each × 12 nouns). Generative edge-case coverage. | ✓ |
| Hand-written exhaustive cases per noun | ~6–8 cases per noun; ~80 tests. Low setup; limited generative coverage. | |
| Hybrid: fast-check for bulk, hand for discriminated unions | fast-check for leaf types; hand for StateEvent union. Balance. | |

**User's choice:** fast-check with per-record arbitraries (Recommended)
**Notes:** Generative coverage catches edge cases imagination misses; ~1000 LOC investment pays off.

### Normalization semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Adapter exposes a normalize(x) helper | Each adapter exports `normalize(body): string`. Property test: `normalize(input) === adapter.getRecord(after putRecord(input))`. Surfaces contract as API. | ✓ |
| Per-noun equivalence relation | Custom `recordEq(a, b): boolean` per noun. Flexible; decouples from adapter; no new API. | |
| Idempotency contract only | `parse(format(parse(x))) === parse(x)`. No normalize needed; matches sibling pattern; weakens SC#2. | |

**User's choice:** Adapter exposes a normalize(x) helper (Recommended)
**Notes:** Phase 8 migration tool benefits from normalize exposure as API.

### Contract deviation route

| Option | Description | Selected |
|--------|-------------|----------|
| Write an ADR + extend contract | Phase 7 ADR; extend `adapters/types.ts` with optional normalize method; D-OQ06-CAPS precedent for additive extension. | ✓ |
| Keep normalize() out of StorageAdapter; per-noun recordEq | Fall back to option B; tests-only. Contract stays frozen. | |
| Normalize as test-helper function, not adapter API | Centralize in tests/conformance/; contract stays frozen; Phase 8 can import. | |

**User's choice:** Write an ADR + extend contract (Recommended)
**Notes:** Follows D-OQ06-CAPS precedent. MarkdownAdapter normalize = identity; BeadsAdapter composes section + frontmatter round-trip.

### CI run-time gating

| Option | Description | Selected |
|--------|-------------|----------|
| Tiered: 10 in CI, 100 nightly | 10 iterations per PR (~2–3 min BeadsAdapter); 100 nightly for deep coverage. Fast feedback + deep coverage. | |
| Uniform 100 iterations | ~25–30 min CI; unambiguous signal per PR; real-time feedback hurts. | |
| Adaptive: iterate until failure or N seconds | Time-budget per tuple (e.g. 60s); variable coverage by hardware. Single CI config. | ✓ |

**User's choice:** Adaptive: iterate until failure or N seconds
**Notes:** Single CI config; graceful degradation when machine is slow.

---

## Claude's Discretion

- Plan count and wave structure (likely 4–6 plans; candidate wave breakdown captured in CONTEXT.md decisions).
- Manifest file organization (single file vs split per kind).
- fast-check arbitrary depth/shrinking settings.
- bd install CI step shape (install-per-job vs cached binary).
- Sibling `./testing` export path.
- Snapshot metadata exclusions for BeadsAdapter diff.
- fast-check version pin policy.
- Section-tuple grep implementation language.
- BeadsAdapter normalize() internal composition.

## Deferred Ideas

- Phase 6.1 withTransaction Outcome B or C rescue if Outcome A gap becomes load-bearing.
- Property-test arbitrary for new nouns (meta-test enforces CI gate when new nouns ship).
- Conformance package publication (`@gsd/conformance`) if external adapter authors materialize.
- Dynamic-anchor refactor sweep — judgment whether it's Phase 7 scope.
- Runtime trace instrumentation for drift detection — only if grep gate proves insufficient.
- Cross-repo PR triggering for sibling — only if consolidate-to-fork causes feedback delays.
- Migration-tool normalize() usage — captured here, consumed by Phase 8 DIST-02.
- bd perf regression dashboard — post-v1.0.
- Wider per-noun coverage if new noun classes emerge.
- Golden-test parity matrix (#2909) — Phase 8 DIST-04.
- Systemic planner-subagent-prompt.md + leak-grep scope retrofit (STATE.md pending todo 2026-05-11) — candidate for folding into Phase 7 since section-anchor grep script touches leak-grep tooling.
