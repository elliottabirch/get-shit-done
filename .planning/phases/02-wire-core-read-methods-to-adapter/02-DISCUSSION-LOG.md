# Phase 2: Wire core read methods to adapter — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 02-wire-core-read-methods-to-adapter
**Areas discussed:** Migration sequencing, `<context>`-block scope (OQ-04), Init-bundler helpers (OQ-09), Phase 2 boundary / CJS read depth

---

## Migration sequencing

### Q1: Plan structure

| Option | Description | Selected |
|--------|-------------|----------|
| Batched by handler family (3-5 plans) | Plan 1 = Bin A primitive consumption pattern + helpers. Plan 2 = init bundlers. Plan 3 = phase/state/progress. Plan 4 = document reads. Plan 5 = `<context>`-block audit. Mirrors Phase 1's 5-plan shape. | ✓ |
| Big-bang single plan | One plan migrates everything. Simplest commit graph; massive diff. | |
| Per-file (~15 plans) | One plan per file. Fine-grained but overhead-heavy. | |

**User's choice:** Batched by handler family.

### Q2: Plan order

| Option | Description | Selected |
|--------|-------------|----------|
| Pattern → leaves → composers | Plan 1 lock pattern in helpers + ref handler; Plan 2-3 leaves; Plan 4 init bundlers (compose leaves); Plan 5 audit. Lowest-risk order. | ✓ |
| Init bundlers first | Heaviest leak surface first; may need to re-touch helpers when leaves migrate. | |
| Independent / parallel-eligible | Each plan independent; allows wave parallelism but requires careful isolation analysis. | |

**User's choice:** Pattern → leaves → composers.

### Q3: Per-plan exit gate

| Option | Description | Selected |
|--------|-------------|----------|
| Leak-grep + existing tests | (a) leak-grep returns zero on touched files, (b) existing test suite passes (D-13). | |
| Leak-grep + new conformance tests per plan | Adds `tests/conformance/` entries for each plan's handlers; ~15-20 new tests; gives Phase 7 a head start. | ✓ |
| Leak-grep + golden snapshot | Capture stdout before/after migration; assert byte-identical. Catches regressions but doesn't generalize to BeadsAdapter. | |

**User's choice:** Leak-grep + new conformance tests per plan.

### Q4: SDK-grep coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Extend leak-grep.cjs with SDK patterns | Add `from 'node:fs'`, `readFileSync`, `fs.readFile`, `readdirSync`, `existsSync`, `statSync` against `.planning/` to the existing engine. Phase 4 inherits. | ✓ |
| Per-plan ad-hoc grep commands | Each plan documents its own grep recipe. No script extension. | |
| Defer SDK grep to Phase 4 | Phase 2 only runs existing leak-grep; SC#1 verified manually. | |

**User's choice:** Extend leak-grep.cjs with SDK patterns.

---

## `<context>`-block scope (OQ-04)

### Q1: Phase 2 deliverable

| Option | Description | Selected |
|--------|-------------|----------|
| Audit + classify, defer strategy to Phase 4 | Exhaustive register with proposed dispositions; strategy lock at Phase 4 LEAKS-02. | ✓ |
| Audit + lock OQ-04 + ship mitigation now | Decide and ship rewrite/intercept/exception in Phase 2. Larger phase scope. | |
| Audit-only, no proposed dispositions | Just file:line list; Phase 4 owns classification AND mitigation. Lightest. | |

**User's choice:** Audit + classify, defer strategy to Phase 4.

### Q2: Register location

| Option | Description | Selected |
|--------|-------------|----------|
| `.planning/leaks/context-block-register.md` | New top-level register directory; visible at repo root. Sets precedent. | ✓ |
| Phase-local: `02-CONTEXT-BLOCK-AUDIT.md` | Self-contained Phase 2 deliverable; Phase 4 reads cross-phase. | |
| JSON-baselined: `scripts/leak-grep-baseline.json` | Couples directly to gate; no human rationale unless sidecar md. | |
| Hybrid: register.md + baseline.json | Both. Cleanest separation but more files. | |

**User's choice:** `.planning/leaks/context-block-register.md`.

### Q3: Classification taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| 3-bucket disposition | REWRITE-CANDIDATE / INTERCEPT-CANDIDATE / EXCEPTION; maps to Phase 4 paths. | ✓ |
| Disposition + reason code | 3-bucket plus enum (STATIC-CONTEXT, RUNTIME-DECISION, TEMPLATE-INTERPOLATION, USER-VISIBLE-ARTIFACT). More schema. | |
| Free-form notes | Each ref gets a paragraph; Phase 4 classifies. Lowest schema commitment. | |

**User's choice:** 3-bucket disposition.

### Q4: Audit scope

| Option | Description | Selected |
|--------|-------------|----------|
| Repo-wide: commands/ + agents/ + get-shit-done/ + docs/ | ~20 `<context>`-block files; comprehensive register. | ✓ |
| Skills + agents only | Skip workflow templates; smaller register. | |
| Comprehensive: also tests/ fixtures + zh-CN/ | Most thorough; intentional fixtures get EXCEPTION. | |

**User's choice:** Repo-wide: commands/ + agents/ + get-shit-done/ + docs/.

---

## Init-bundler helpers (OQ-09)

### Q1: Helper location

| Option | Description | Selected |
|--------|-------------|----------|
| SDK-side shared helpers | Helpers in helpers.ts/roadmap.ts/phase.ts call adapter primitives internally; init bundlers call helpers. Adapter contract stays Bin A only. | ✓ |
| Per-bundler primitive composition | Each bundler inlines adapter calls; some logic duplicated. Pure SYNTHESIS recommendation. | |
| New Bin B reads on adapter | Promote shared logic into Bin B (e.g. `adapter.getMilestoneInfo()`). Re-opens D-10. | |

**User's choice:** SDK-side shared helpers.

### Q2: DI shape

| Option | Description | Selected |
|--------|-------------|----------|
| Adapter as explicit first parameter | `(adapter, ...rest)` signature for every adapter-aware helper. Verbose but unambiguous. | ✓ |
| Helpers accept HandlerCtx with adapter inside | `{adapter, projectDir, ...}` context object. Future-proof but slight indirection. | |
| Module-scoped adapter (set by createRegistry) | Module-private state; hides DI. Goes against D-07. | |

**User's choice:** Adapter as explicit first parameter.

### Q3: stat() gap resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Bin A with `stat()` primitive | Add `stat(path): Promise<{ kind: 'file' \| 'dir'; mtime?: string } \| null>`. Re-opens D-10 with new ADR. | ✓ |
| Drop the gap into Phase 5 | Document `statSync` reads as REGRESSION-DEFERRED in Phase 2. Leaks remain behind PHASE5-LEAK comments. | |
| Use listCollection to infer isDirectory; defer mtime | Awkward but no contract change; possible intel.ts mtime regression. | |

**User's choice:** Extend Bin A with `stat()` primitive.

### Q4: stat() required vs capability-gated

| Option | Description | Selected |
|--------|-------------|----------|
| Required (Bin A) | Joins record/section/frontmatter as required. BeadsAdapter MUST implement; can synthesize from issue.updated_at. | ✓ |
| Capability-gated (new closed-enum entry: `capabilities.stat`) | 7th optional capability; companion type guard `hasStat()`. More flexibility. | |
| Two methods: `kindOf` required + `mtimeOf` capability-gated | Split concerns; doubles the contract delta. | |

**User's choice:** Required (Bin A).

---

## Phase 2 boundary / CJS read depth

### Q1: SDK TS files importing CJS via createRequire

| Option | Description | Selected |
|--------|-------------|----------|
| Replace CJS calls with adapter.* calls | TS handlers stop calling CJS for fs-bound logic; adapter wraps the same CJS internally. Net behavior identical; seam at TS layer. | ✓ |
| Keep CJS for non-fs concerns; move fs to adapter | Two-step migration per call site; verbose but precise about seam coverage. | |
| Push the seam into CJS (CJS becomes adapter-aware) | Modify CJS helpers to accept adapter. Inverts D-02 — rejected pattern. | |

**User's choice:** Replace CJS calls with adapter.* calls.

### Q2: Mixed read+write files

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate read calls only; leave writes untouched | Per-line discipline; writes wait for Phase 3. Files in mixed state for ~1-2 weeks. | ✓ |
| Migrate file-at-a-time (reads + writes) | Crosses Phase 2 boundary; faster end state but blurs phase scope. | |
| Refactor up-front: split into read.ts/write.ts | Cleanest phase boundaries; refactor cost up-front; disturbs git blame. | |

**User's choice:** Migrate read calls only; leave writes untouched.

### Q3: C2 files (profile-* / workstream / etc.)

| Option | Description | Selected |
|--------|-------------|----------|
| Path-scoped grep — C2 naturally excluded | Leak-grep fires only against `.planning/`-prefixed paths; C2 files reading user-global paths pass naturally. No allowlist. | ✓ |
| Explicit allowlist of C2 files | `scripts/leak-grep-c2-allowlist.json`; explicit but coupling. | |
| Catch-all: every node:fs read in `sdk/src/query/` is a leak | Forces C2 migration; violates SYNTHESIS classification. | |

**User's choice:** Path-scoped grep.

### Q4: Out-of-scope confirmation (multi-select; misclick caught)

| Option | Description | Selected (after confirm) |
|--------|-------------|----------|
| All of these stay out-of-scope | Write paths → Phase 3, workflow `.md` → Phase 4 LEAKS-01, `<context>`-mitigation → Phase 4 LEAKS-02, CJS files untouched, C2 path-scoped, golden tests via D-13. | ✓ |
| Pull in: write paths in mixed files | Reverses Q2 above. | |
| Pull in: CJS file migration | Reverses Q1 above + contradicts D-02. | |
| Pull in: `<context>`-block strategy lock | Reverses area 2 above. | |

**User's first answer:** picked the three "Pull in" options simultaneously.
**Reflection:** Claude flagged the multi-select as reversing recently-locked decisions and asked for confirmation.
**User's confirm answer:** "I misclicked — keep the original boundaries."
**Resulting choice:** All of these stay out-of-scope. (Original boundaries hold.)

---

## Claude's Discretion

- Internal naming for the Plan 1 reference handler (likely `findPhase`)
- Exact extended leak-grep pattern regex
- Conformance test naming convention
- Whether to ship a small migration recipe doc alongside Plan 1
- Whether the audit register file is markdown-only or ships an accompanying JSON sidecar (Phase 4 picks consumption shape)

## Deferred Ideas

- `<context>`-block mitigation strategy lock — Phase 4 LEAKS-02
- Leak-grep CI gate wiring — Phase 4 LEAKS-04
- Write-path migration in mixed files — Phase 3
- CJS file migration — NEVER (D-02 permanent)
- Foundational primitive implementations — Phase 5
- Bin B method signatures on adapter — Phase 3 (writes) / Phase 5 (foundational)
- Empirical #2909 golden parity proof — Phase 8 DIST-04
- Logical-ref method shapes — Phase 5 or v1.1
- Read-side migration recipe doc — Claude's discretion alongside Plan 1
