# Plan 06-03: bd Primitives Spike — Results

**Executed:** 2026-05-12T00:12:58.557Z
**bd version:** `bd version 1.0.4 (Homebrew)` (family 1.0.4)
**Version variance:** sibling was pinned at v1.0.3 `1b2dd2cb`; user ran spike against v1.0.4 (Homebrew patch release). New subcommands visible in §1.2 (e.g. `delete`, `comment`, `q`). Flagged for Task-3 human-verify checkpoint.

---

## §1. bd CLI catalog discovered

### §1.1 — bd --version

**Verdict:** PASS
**Command:** `bd --version`

```
bd version 1.0.4 (Homebrew)
```

**Notes:** family: 1.0.4

### §1.2 — bd subcommand catalog (top-level)

**Verdict:** PASS
**Command:** `bd --help`

```
assign, children, close, comment, comments, create, create-form, delete, edit, gate, label, link, list, merge-slot, note, priority, promote, query, reopen, search, set-state, show, state, tag, todo, update, count, diff, history, lint, stale, status, statuses, types, dep, duplicate, duplicates, epic, graph, supersede, swarm, backup, branch, export, federation, import, restore, vc, bootstrap, config, context, dolt, forget, hooks, human, info, init, kv, memories, onboard, prime, quickstart, recall, remember, setup, where, batch, compact, doctor, flatten, gc, migrate, ping, preflight, prune, purge, rename-prefix, rules, sql, upgrade, worktree, admin, jira, linear, repo, ado, audit, blocked, completion, cook, defer, formula, github, gitlab, help, init-safety, mail, mol, notion, orphans, ready, rename, ship, undefer, version
```

**Notes:** 105 subcommands discovered

## §2. Named-JSON-field availability (D-MAPPING)

### §2.1 — bd update <id> --metadata <json> accepted?

**Verdict:** PASS
**Command:** `bd update spike-bd-a2l63t-afx --metadata '{"gsd_section":"Evidence","gsd_body":"probe-value"}'`

```
exit=0; stdout=✓ Updated issue: spike-bd-a2l63t-afx — probe-issue-2; stderr=
```

**Notes:** --metadata primitive ACCEPTED by v1.0.4 — candidate for named-JSON-field storage

### §2.2 — Does `bd show <id> --json` roundtrip the metadata?

**Verdict:** PASS
**Command:** `bd show spike-bd-a2l63t-afx --json`

```
stdout first 400 chars: [
  {
    "id": "spike-bd-a2l63t-afx",
    "title": "probe-issue-2",
    "description": "seed body 2",
    "status": "open",
    "priority": 2,
    "issue_type": "task",
    "owner": "elliott.birch@addepar.com",
    "created_at": "2026-05-12T00:12:45Z",
    "created_by": "seed",
    "updated_at": "2026-05-12T00:12:47Z",
    "metadata": {
      "gsd_body": "probe-value",
      "gsd_section": "Evide
```

**Notes:** metadata key+value both visible in show output

### §2.3 — Does `bd export --json` roundtrip the metadata byte-level?

**Verdict:** PASS
**Command:** `bd export --json`

```
body length=728; contains "gsd_section"? true; contains "probe-value"? true
```

**Notes:** metadata survives export — candidate storage for L2/L3 section content in Outcome A

### §2.4 — bd update <id> --set-metadata key=value accepted and visible?

**Verdict:** PASS
**Command:** `bd update spike-bd-a2l63t-afx --set-metadata gsd_probe=setmeta`

```
setmeta exit=0; show contains "gsd_probe"? true
```

### §2.5 — bd update --help flag inventory (first 20)

**Verdict:** PASS
**Command:** `bd update --help`

```
--acceptance
--add-label
--allow-empty-description
--append-notes
--await-id
--body-file
--claim
--defer
--design
--design-file
--due
--ephemeral
--external-ref
--history
--metadata
--no-history
--notes
--parent
--persistent
--remove-label
```

## §3. Store-clone + bead-hash bookmark primitives (D-TXN Outcome B)

### §3.1 — bd dolt subcommand inventory

**Verdict:** PASS
**Command:** `bd dolt --help`

```
Configure and manage Dolt database settings and server lifecycle.

Beads uses a dolt sql-server for all database operations. The server is
auto-started transparently when needed. Use these commands for explicit
control or diagnostics.

Server lifecycle:
  bd dolt start        Start the Dolt server for this project
  bd dolt stop         Stop the Dolt server for this project
  bd dolt status       Show Dolt server status

Configuration:
  bd dolt show         Show current Dolt configuration with connection test
  bd dolt set <k> <v>  Set a configuration value
  bd dolt test         Test server connection

Version control:
  bd dolt commit       Commit pending changes
  bd dolt push         Push commits to Dolt remote
  bd dolt pull         Pull commits from Dolt remote

Remote management:
 
```

**Notes:** bd dolt passthrough exists — inspect for branch/clone/bookmark

### §3.2 — bd dolt branch --help available?

**Verdict:** PASS
**Command:** `bd dolt branch --help`

```
exit=0; stdout head=Configure and manage Dolt database settings and server lifecycle.

Beads uses a dolt sql-server for all database operations. The server is
auto-started transpar; stderr head=
```

### §3.2 — bd dolt clone --help available?

**Verdict:** PASS
**Command:** `bd dolt clone --help`

```
exit=0; stdout head=Configure and manage Dolt database settings and server lifecycle.

Beads uses a dolt sql-server for all database operations. The server is
auto-started transpar; stderr head=
```

### §3.2 — bd dolt bookmark --help available?

**Verdict:** PASS
**Command:** `bd dolt bookmark --help`

```
exit=0; stdout head=Configure and manage Dolt database settings and server lifecycle.

Beads uses a dolt sql-server for all database operations. The server is
auto-started transpar; stderr head=
```

### §3.2 — bd branch --help available?

**Verdict:** PASS
**Command:** `bd branch --help`

```
exit=0; stdout head=List all branches or create a new branch.

This command requires the Dolt storage backend. Without arguments,
it lists all branches. With an argument, it create; stderr head=
```

### §3.3 — Post-hoc analysis of §3.2 probes (CORRECTION)

**Verdict:** FAIL (D-TXN Outcome B primitives NOT present)

**Analysis:** The raw `§3.2` probes for `bd dolt branch --help`, `bd dolt clone --help`, and `bd dolt bookmark --help` all returned `exit=0` — BUT inspection of their stdout reveals they returned the GENERIC `bd dolt --help` output (the "Configure and manage Dolt database settings..." preamble), NOT subcommand-specific help. In cobra-based CLIs (which `bd` uses), an unknown subcommand passed with `--help` often falls through to the parent command's help with exit 0.

Per §3.1 `bd dolt --help` canonical output, the `bd dolt` namespace exposes ONLY: `start, stop, status, show, set, test, commit, push, pull, remote (add/list/remove)`. **No `clone`, `branch`, or `bookmark` subcommand exists.** `bd branch` (top-level, separate from `bd dolt`) exists but is git-branch-like (list/create named branches) — NOT a cheap content-address clone with atomic bookmark swap.

**D-TXN Outcome B (staging store + bead-hash bookmark) is INFEASIBLE in bd v1.0.4.** Would require either upstream bd feature-add (cheap store-clone + atomic reference swap) or direct Dolt-level invocation bypassing bd (rejected per "bd CLI shell-out everywhere" discipline).

## §4. File-snapshot primitives (D-TXN Outcome C)

### §4.1 — bd export --json -o <path> succeeds and writes a file?

**Verdict:** PASS
**Command:** `bd export --json -o /var/folders/jl/xksx9g4j431_c4q3tynlms2r0000gn/T/spike-bd-a2l63t/snapshot.jsonl`

```
exit=0; file exists=true; time=424ms; stderr=Exported 2 issues to /var/folders/jl/xksx9g4j431_c4q3tynlms2r0000gn/T/spike-bd-a2l63t/snapshot.jsonl
```

### §4.2 — bd init --from-jsonl restores exported state?

**Verdict:** FAIL (raw probe) → **PASS (with v1.0.4 invocation adjustment, verified out-of-band)**
**Command (as probed by script):** `bd init --from-jsonl /tmp/<abs-path>/snapshot.jsonl --non-interactive --quiet`

```
init exit=1; time=1055ms; list-restored count=0; init stderr=Error: --from-jsonl specified but .beads/issues.jsonl does not exist
```

**Notes:** **v1.0.4 BREAKING CHANGE from v1.0.3:** `bd init --from-jsonl` in v1.0.4 requires the JSONL to be at the literal path `.beads/issues.jsonl` inside the target directory, NOT at an arbitrary absolute path. Out-of-band reprobe pattern that PASSES:

```bash
# v1.0.4-compatible snapshot/restore invocation:
# 1. Export source store to target's expected location (pre-seed)
mkdir -p <targetDir>/.beads
bd -C <sourceDir> export --json -o <targetDir>/.beads/issues.jsonl
# 2. Initialize target from the pre-placed JSONL
cd <targetDir> && bd init --from-jsonl .beads/issues.jsonl --non-interactive --quiet
# 3. Verify: bd list --json --all returns the original issues
```

Reprobe confirmed ~440ms init time with both probe-issues restored intact. RESEARCH Pitfall 6 predicted 400-700ms cold-start; measured ~440ms (within budget). **Outcome C remains viable** with the revised invocation.

**Additional finding — `bd init` side-effects in v1.0.4:** `bd init` in v1.0.4 now unconditionally installs Claude Code hooks, creates/updates `CLAUDE.md`, and writes `.claude/settings.json` (sibling's `--skip-agents` / `--skip-hooks` flags may no longer exist in v1.0.4 or may have different semantics). Plan 06-06 (withTransaction impl) must:
(a) run snapshot/restore in a throwaway tmpdir (not the project root), and
(b) not expect to be able to suppress the agent/hook installation through flags.

**Additional finding — `bd backup` subsystem (v1.0.4):** v1.0.4 exposes a full `bd backup` family (`init`/`sync`/`restore`/`status`/`remove`) for off-machine recovery. Not evaluated for D-TXN because it targets durable remote backup, not in-process transactional snapshot. Noted for future reference.

## §5. Comment structure (Landmine 4 reverify)

### §5.1 — Does bd comments add --label work? (Landmine 4 reverify)

**Verdict:** FAIL
**Command:** `bd comments add spike-bd-a2l63t-afx --label test:label label-body`

```
labelAttempt exit=1; export contains 'test:label'? false; stderr=Error: unknown flag: --label
Usage:
  bd comments add [issue-id] [text] [flags]

Flags:
  -a, --author string   Add author to comment
  -f, --file string     Re
```

**Notes:** --label rejected (stderr: Error: unknown flag: --label
Usage:
  bd comments add [issue-id] [text] [flags]

Flags:
  -a, --author string   Add auth) — Landmine 4 TIGHTENED (was silent, now hard-rejects)

### §5.2 — Does bd comments add --author preserve in export?

**Verdict:** PASS
**Command:** `bd comments add spike-bd-a2l63t-afx --author gsd:event:test author-body`

```
authorAttempt exit=0; export contains 'gsd:event:test'? true
```

**Notes:** --author remains the structured channel per sibling D-09 amendment

### §5.3 — bd comments add --help inventory

**Verdict:** PASS
**Command:** `bd comments add --help`

```
Add a comment to an issue.

Examples:
  # Add a comment
  bd comments add bd-123 "Working on this now"

  # Add a comment from a file
  bd comments add bd-123 -f notes.txt

Usage:
  bd comments add [issue-id] [text] [flags]

Flags:
  -a, --author string   Add author to comment
  -f, --file string     Read comment text from file
  -h, --help            help for add

Global Flags:
      --actor string              Actor name for audit trail (default: $BEADS_ACTOR, git user.name, $USER)
      --db 
```

## §6. Memory API reverify

### §6.1 — bd remember + bd recall round-trip?

**Verdict:** PASS
**Command:** `bd remember 'probe-value-42' --key test-mem-1; bd recall test-mem-1`

```
remember exit=0; recall exit=0; recall stdout=probe-value-42; recall stderr=
```

**Notes:** memory-key format v1.0.4: simple string keys; JSON body is freeform

### §6.2 — bd remember --help inventory

**Verdict:** PASS
**Command:** `bd remember --help`

```
Store a memory that persists across sessions and account rotations.

Memories are injected at prime time (bd prime) so you have them
in every session without manual loading.

Examples:
  bd remember "always run tests with -race flag"
  bd remember "Dolt phantom DBs hide in three places" --key dolt-phantoms
  bd remember "auth module uses JWT not sessions" --key auth-jwt

Usage:
  bd remember "<ins
```

## §8. Landmines 5/6/7 reverify + bd delete --cascade (Open Q #2)

### §8.1 — Landmine 5: bd show <id> --json returns single-element array?

**Verdict:** PASS
**Command:** `bd show spike-bd-a2l63t-afx --json`

```
type=array; length=1; stdout head=[
  {
    "id": "spike-bd-a2l63t-afx",
    "title": "probe-issue-2",
    "descri
```

**Notes:** Landmine 5 STILL PRESENT — BdRunner.show() array-unwrap continues correct

### §8.2 — Landmine 6: bd export --json emits JSONL (not JSON array)?

**Verdict:** PASS
**Command:** `bd export --json`

```
body first 120 chars: {"_type":"issue","id":"spike-bd-a2l63t-afx","title":"probe-issue-2","description":"seed body 2","status":"open","priorit; length=925
```

**Notes:** JSONL — BdRunner JSONL fallback correct

### §8.3 — Landmine 7: empty store → {error, schema_version} at exit 0?

**Verdict:** FAIL
**Command:** `bd list --json --all (empty store)`

```
exit=0; body first 160 chars: []
```

**Notes:** bd NOW returns empty array for empty store — update BdRunner sentinel match

### §8.4 — Open Q #2: bd delete --cascade --force works on parent→child?

**Verdict:** PASS
**Command:** `bd delete spike-bd-a2l63t-afx --cascade --force`

```
exit=0; stdout=✓ Deleted 1 issue(s)
  Removed 1 dependency link(s)
  Removed 0 label(s)
  Removed 3 event(s)
  Updated text references in 0 issue(s); stderr=
```

**Notes:** removeCollection CAN use --cascade; avoids listCollection + remove-per-issue loop

## §7. CHOSEN OUTCOMES

### D-MAPPING: **A** (named-JSON-field / sub-records available)

**Evidence:**
- §2.1 PASS: `bd update <id> --metadata '{"gsd_section":"Evidence","gsd_body":"probe-value"}'` exits 0, update accepted.
- §2.2 PASS: `bd show <id> --json` returns a structured `"metadata": { "gsd_body": "probe-value", "gsd_section": "Evidence" }` nested object — round-trip verified at the single-issue read path.
- §2.3 PASS: `bd export --json` contains both `gsd_section` and `probe-value` — metadata survives the bulk-export path, required for restore.
- §2.4 PASS: `bd update <id> --set-metadata gsd_probe=setmeta` (repeatable key=value form) also round-trips.

**Rationale:** bd v1.0.4 exposes a structured `metadata` field on issues (accessed via `--metadata <json>` and `--set-metadata key=value`). The field is a first-class nested JSON object that survives both single-issue reads (`bd show --json`) and bulk export (`bd export --json`). This is the named-JSON-field primitive sibling could NOT find in v1.0.3, making Outcome A (sub-records mapping) viable for the first time.

**MAJOR SURPRISE flagged for Task 4 checkpoint:** Sibling's 71-test v1.0.3 base concluded Outcome A infeasible. v1.0.4 introduces `--metadata` / `--set-metadata` flags that change the picture. User approval required before Plans 06-04 / 06-06 lock scope.

**Implications for Plan 06-04 (format scope):**
- Outcome A → 12+ per-canonical-file TypeScript schemas (D-MAPPING-SCHEMA original vision). L2 sections map to `issue.metadata.<section>` sub-records (overwritten via `bd update --metadata` with the merged JSON); L3/L4 nested content stays in anchor-tagged comments per original design.
- Per-canonical-file schemas: `roadmap.ts` (phase parser), `state.ts` (state events), plus per-section schemas for each canonical file's L2 structure (phase, plan, summary, uat, state-event, debug, intel, learnings). Schema authoring scope inflates from the labels-first Outcome-B budget.

**Implications for Plan 06-06 (recordState* dispatch):**
- `recordStateMutation` dispatches to `bd update --metadata` sub-record array ops (updating a key within `issue.metadata` preserving other keys).
- `recordStateAppend` high-frequency → `bd comments add --author gsd:event:<type>` (Landmine 4 discipline unchanged — see §5).
- `recordStateAppend` low-frequency → `bd remember <json> --key <milestone>:<type>:<id>` (§6 unchanged).
- `recordStateSignal` → label delete OR memory-key delete.
- 16-case `StateWriteOutcome` matrix: `created_section` variant MAY be emitted (previously Pitfall 7 predicted Outcome B would never emit it; Outcome A restores the ability to distinguish first-append vs subsequent).

### D-TXN: **A** (in-memory write-buffer) — LOCKED via user override

**Status:** Task-4 human-verify checkpoint resolved with user OVERRIDE of the Task-3 Outcome-C proposal. Outcome A is shipped. See "Outcomes not chosen" below for Outcomes B and C evidence preserved for Phase 6.1 revisit.

**Shipped design:** `withTransaction` buffers all mutations (per-issue `update` + `create` + `delete` + comment/label/memory side effects) in an in-memory list inside the transaction scope. On commit, the buffer is replayed as a sequence of real `bd` invocations; on rollback, the buffer is discarded (no bd invocations issued — store is untouched by the txn). `capabilities.snapshot: false`; `capabilities.transaction: true`.

**Evidence (why Outcome C was rejected despite being technically viable):**
- §3.3 FAIL: Outcome B primitives absent (bd v1.0.4 `bd dolt` exposes only `start/stop/status/show/set/test/commit/push/pull/remote` — no `clone/branch/bookmark`).
- §4.1 PASS: `bd export --json -o <path>` writes JSONL snapshot in 424ms.
- §4.2 PASS (with v1.0.4 invocation adjustment): `bd init --from-jsonl .beads/issues.jsonl` restores state in ~440ms BUT carries side effects per the §4.2 "Additional finding" block: `bd init` in v1.0.4 unconditionally installs Claude Code hooks, creates/updates `CLAUDE.md`, and writes `.claude/settings.json`. Even when the init runs in a throwaway tmpdir, the side-effect channel is a risk surface (Claude Code hooks + CLAUDE.md pollution if the tmpdir discipline ever leaks to the project root).

**Rationale (user decision — 2026-05-12 Task-4 override):**
1. **Scope simplicity.** Outcome A ships as a ~150 LOC in-memory buffer inside `src/txn/buffer.ts`. Outcome C would add `src/txn/snapshot.ts` with file-snapshot + `bd init` spawn + POSIX `.beads/` atomic rename + Landmine-12 prefix derivation + tmpdir cleanup discipline — strictly more code and more moving parts.
2. **Accepts mid-txn multi-commit gap.** Outcome A's known weakness: if the commit phase fails partway through replaying the buffer, bd is left with a partial commit that Outcome A cannot roll back (no snapshot to restore to). **This is documented as a Phase 6.1 follow-up gap**, NOT a regression — acceptable for v1.0 ship given Phase 6 scope.
3. **Bypasses v1.0.4 `bd init` side-effect surface entirely.** Outcome A never calls `bd init` during a transaction. The side-effect channel (Claude Code hooks + CLAUDE.md pollution in tmpdirs) becomes non-existent rather than contained.
4. **Phase 7 CONFORM-04 failure-injection test will FAIL on BeadsAdapter under Outcome A.** CONFORM-04 exercises mid-txn crash + snapshot rollback; BeadsAdapter under Outcome A cannot pass by design. **Flagged as a known gap, NOT a regression** — CONFORM-04 becomes an Outcome-A-skip-with-known-limitation rather than a green test. Phase 6.1 (or later) revisits by flipping to Outcome C if/when the `bd init` side-effect surface is mitigated upstream.

**Capabilities impact (D-TXN-CAPS):**
- `capabilities.transaction: true` (Outcome A — pipeline.ts dry-run needs it; satisfied by the buffer itself, which can execute in "dry-run" mode by discarding at the end).
- `capabilities.snapshot: false` (Outcome A does NOT provide snapshot semantics; it provides write-buffering. SYNTHESIS §9 HIGH-severity dry-run gate is partially closed via dry-run-via-buffer-discard; full snapshot-rollback semantics deferred to Phase 6.1.)

**Implications for Plan 06-06 (withTransaction impl path):**
- Ship `src/txn/buffer.ts` (Outcome A) as the sole txn implementation: ~150 LOC in-memory ordered list of pending ops; `commit()` replays the list as real bd invocations; `rollback()` discards without replay.
- Per-op buffering schema: each entry tags the event family (`recordStateMutation` / `recordStateAppend` / `recordStateSignal` / section-level `update` / record-level `putRecord` / binary asset no-op) + the bd primitive + args. Plan 06-06 author decides whether to buffer as "structured events" or "raw bd argv" — both work for Outcome A.
- `capabilities.snapshot: false` declared in `src/capabilities.ts`. README documents Outcome A variant shipped + the mid-txn-commit-gap caveat + the Phase 6.1 follow-up plan.
- **Phase 6.1 follow-up required** for mid-txn commit atomicity. Tracked via `deferred-items.md` entry (appended in Task 4 of this plan).
- **Phase 7 CONFORM-04 known-gap** flag: conformance suite should either skip CONFORM-04 on BeadsAdapter (if the suite honors capability-gated test selection) or expect an Outcome-A-specific known-failure disposition. Exact test integration decided by Plan 06-07.

### Outcomes not chosen (preserved for Phase 6.1 revisit)

**Outcome B (staging store + bead-hash bookmark) — INFEASIBLE in bd v1.0.4.** Evidence: §3.3 canonical `bd dolt --help` output shows no `clone`, `branch`, or `bookmark` subcommand in the `bd dolt` namespace. Top-level `bd branch` exists but is git-branch-like (named branches), not a cheap content-address clone with atomic bookmark swap. Would require upstream bd feature-add (rejected for v1.0 timeline) or direct Dolt-level invocation bypassing bd (rejected per "bd CLI shell-out everywhere" discipline).

**Outcome C (file-snapshot restore via `bd export` + `bd init --from-jsonl`) — FEASIBLE, REJECTED by user override.** Evidence: §4.1 PASS (424ms snapshot) + §4.2 PASS with v1.0.4 invocation adjustment (~440ms restore). Rejected because: (a) scope larger than Outcome A's ~150 LOC buffer; (b) carries the `bd init` side-effect surface (Claude Code hooks + CLAUDE.md pollution even in tmpdirs); (c) Outcome A's simpler design was judged acceptable given the mid-txn-commit-gap is bounded and documented. **Phase 6.1 revisit trigger:** if CONFORM-04 adoption becomes mandatory, or if the `bd init` side-effect surface is mitigated upstream (e.g., a `bd init --no-install-hooks` flag), Outcome C becomes attractive again and the Phase 6.1 migration is ~300 LOC swap of `src/txn/buffer.ts` → `src/txn/snapshot.ts` with the Landmine-12 prefix-derivation fix already captured here.

## §9. Shipped bd CLI commands for chosen outcomes

### D-MAPPING Outcome A — event-family dispatch (bd v1.0.4):
- `bd list -l <label> --json --all -n 0` — collection/singleton reads (label-scoped list; unchanged from sibling).
- `bd show <id> --json` — single-issue read (array-unwrap per Landmine 5; still correct in v1.0.4 per §8.1).
- `bd update <id> --metadata <json-string>` — **NEW v1.0.4** — overwrite entire `issue.metadata` JSON object. Use when `recordStateMutation` overwrites a whole section payload.
- `bd update <id> --set-metadata <key>=<value>` — **NEW v1.0.4** — set a single metadata key (repeatable flag). Use when `recordStateMutation` targets a specific sub-key without reading/merging.
- `bd update <id> --description <body>` — bd-routed section rewrites when description holds the whole-file body; also `--body-file -` for stdin read.
- `bd update <id> --add-label <label>` / `bd update <id> --remove-label <label>` — frontmatter labels (unchanged from sibling).
- `bd remember '<json>' --key '<milestone>:<type>:<id>'` — memory-typed state events (§6.1 round-trip verified).
- `bd recall <key>` — memory read (§6.1 PASS).
- `bd comments add <bead> --author 'gsd:event:<type>' '<body>'` — comment-typed state events (**Landmine 4: use `--author`, NEVER `--label` — v1.0.4 now hard-rejects `--label` with exit 1 per §5.1**).
- `bd comments <bead> --json` — read comments as JSON array (unchanged).
- `bd delete <id> --cascade --force` — **NEW resolution for Open Q #2** — `removeCollection` can invoke cascade delete instead of listCollection + per-issue remove loop (§8.4 PASS).

### D-TXN Outcome A — withTransaction primitives (bd v1.0.4):

Outcome A does NOT issue any dedicated snapshot/restore bd commands. `withTransaction` is purely an in-process buffer + replay layer. The bd commands it invokes are the SAME commands the event-family dispatch (D-MAPPING Outcome A above) would invoke directly — they are just deferred until commit.

**Commit-path replay (buffered-op → bd invocation mapping):**
- `bd update <id> --metadata '<json>'` — replays a buffered `recordStateMutation` sub-record overwrite.
- `bd update <id> --set-metadata <key>=<value>` — replays a buffered single-key sub-record update.
- `bd update <id> --description <body>` (or `--body-file -`) — replays a buffered section-level update when the section is `description`.
- `bd update <id> --add-label <label>` / `bd update <id> --remove-label <label>` — replays a buffered frontmatter label mutation.
- `bd create <title> ...` — replays a buffered `putRecord` create.
- `bd delete <id> --cascade --force` — replays a buffered `removeCollection` / `remove` delete.
- `bd comments add <bead> --author 'gsd:event:<type>' '<body>'` — replays a buffered high-frequency `recordStateAppend`.
- `bd remember '<json>' --key '<milestone>:<type>:<id>'` — replays a buffered low-frequency `recordStateAppend` or `recordStateSignal` set.
- `bd forget <key>` (or equivalent per §6) — replays a buffered `recordStateSignal` delete.

**Rollback-path:** NO bd commands issued. The buffer is discarded in-process; bd store is untouched.

**Dry-run / pipeline.ts support:** `transaction.dryRun === true` enters the same buffer, then rollback-path discards — no bd invocations issued. Satisfies pipeline.ts's dry-run requirement without needing snapshot semantics.

**Mid-txn commit failure (known gap — Phase 6.1 follow-up):** If a buffered op fails mid-replay (e.g., bd crashes on op #N of K), bd is left with ops 1..(N-1) committed and ops (N+1)..K unapplied. Outcome A cannot roll back ops 1..(N-1) because no snapshot was taken. Plan 06-06 implementation should: (a) document this in the `withTransaction` JSDoc, (b) surface the partial-commit state to the caller via a structured error (e.g., `BeadsPartialCommitError` with `{committedOps, failedOp, remainingOps}`), (c) let Phase 6.1 decide whether to ship Outcome C as a migration path.

### Dep-graph synthesizer (BEADS-03, unchanged from Spike 014):
- `bd export --json` — single spawn surfaces all edges (fits ≤2-spawn budget).
- Filter JSONL for `_type === 'issue'`, flatMap `(issue.dependencies || []).filter(d => d.type === 'blocks')`, map to `{from: d.depends_on_id, to: issue.id, type: 'dependency', confidence: 1.0}`.
