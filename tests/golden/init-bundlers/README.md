# Init Bundler Golden Baselines

Pre-Plan-1 reference outputs for all 17 init bundlers. Captured BEFORE any
Plan 1 task mutated the bundler call graph (HIGH-3 fix from Phase 2 Plan 1
revision pass 1).

**Baselines captured at HEAD `1ced5a55d5c062d608598b7dc268b1393a7ccdf4` BEFORE Plan 1 mutations.**

## Purpose

Plan 4 (Phase 2 — init bundler migration) will compose adapter primitives
internally for these bundlers while preserving their **coarse external bundle
shape** (per OQ-09 + ROADMAP SC#2). The Plan 4 byte-identical assertion
compares post-Plan-4 JSON against the `*.before.json` files in this directory.

If the baseline were captured AFTER any Plan 1 task ran (Tasks 4–6 in particular
modify `state-project-load.ts`, `route-next-action.ts`, and `createRegistry`
plumbing — all of which sit on bundler call paths), the assertion would silently
allow regressions because the comparison reference would itself contain the
post-Plan-1 behavior. Capturing FIRST locks in pre-fork-migration semantics.

## Capture method

The fork's compiled `sdk/dist/cli.js` has a known import-path issue: it imports
`'../../adapters/markdown/index.js'`, but the adapters package ships its
compiled output under `adapters/dist/markdown/`. This pre-existing issue blocks
direct CLI invocation from the worktree. Per the plan's allowance for
capture-method flexibility, baselines were captured by running the SDK's
TypeScript sources directly via `vite-node` (already a SDK dev dependency),
which bypasses the broken `dist/` path entirely. The TS sources at this commit
are pre-Plan-1 by construction — every bundler ran against an unmutated
`createRegistry({adapter})` plumbing layer.

The capture script:

1. Loaded `createRegistry` and `MarkdownAdapter` from the worktree TS source.
2. Constructed a registry rooted at the worktree project directory.
3. Dispatched each of the 17 commands below with sensible default arguments.
4. Wrote the raw JSON `result.data` to `<command>.before.json`.

Non-determinism (timestamps, absolute paths) is **not** sanitized at capture
time — Plan 4's byte-identical assertion will apply the same normalization
regex to BOTH sides at compare time, so leaving raw output here keeps the
reference semantically faithful.

## Bundlers captured

| Command                    | Args used        | Source file        |
| -------------------------- | ---------------- | ------------------ |
| `init.execute-phase`       | `02`             | init.ts            |
| `init.plan-phase`          | `02`             | init.ts            |
| `init.new-milestone`       | (none)           | init.ts            |
| `init.quick`               | (none)           | init.ts            |
| `init.ingest-docs`         | (none)           | init.ts            |
| `init.resume`              | (none)           | init.ts            |
| `init.verify-work`         | `02`             | init.ts            |
| `init.phase-op`            | `02`             | init.ts            |
| `init.todos`               | (none)           | init.ts            |
| `init.milestone-op`        | (none)           | init.ts            |
| `init.map-codebase`        | (none)           | init.ts            |
| `init.new-workspace`       | (none)           | init.ts            |
| `init.list-workspaces`     | (none)           | init.ts            |
| `init.remove-workspace`    | `feat-foo`       | init.ts            |
| `init.new-project`         | (none)           | init-complex.ts    |
| `init.progress`            | (none)           | init-complex.ts    |
| `init.manager`             | (none)           | init-complex.ts    |

All 17 captures succeeded; zero failures. (The plan's nominal target of "13
of 16 minimum" is comfortably exceeded — there are actually 17 init handlers
total, not 16, because `init.ts` exports 14 bundlers, not 13.)

## Plan 4 usage

When Plan 4 runs, it should:

1. Re-dispatch each bundler post-migration with the same arg set.
2. Normalize timestamps and absolute paths in BOTH the post-migration output
   and the `*.before.json` reference.
3. Diff the normalized JSONs — any non-empty diff is a regression.

Per Plan 4 task scope, sanitization regex lives there, not here.
