# Archive: Greenfield Phase 6 artifacts

**Archived:** 2026-05-11
**Reason:** Phase 6 pivoted from "greenfield scaffold of `~/code/gsd-beads`" to "hybrid — integrate with existing sibling at `/Volumes/code/gsd-beads` (`main` @ 5082d45)" after the user surfaced that the sibling repo already exists and is mid-execution on related-but-different adapter goals.

**Pivot trigger:** The sibling repo was already on its own Phase 7 (`capabilities-flag-bin-a-primitives-foundational-primitives`) with ~1000 LOC of shipped primitive code, 71 conformance tests, and 13 concluded spikes — not the empty scaffold our planning assumed.

**Supersedes:** Everything here. The current Phase 6 artifacts are in the parent directory. The `## Post-Extraction Amendments` section of `../06-CONTEXT.md` documents which locked decisions flipped and which re-affirmed.

**Do NOT execute these plans.** They were designed against assumptions that turned out to be wrong. They contain valuable patterns (wave structure, requirement coverage, acceptance-criteria discipline) but the file paths, tech stack (.ts vs sibling's .mjs), test runner (vitest vs sibling's node:test), and scaffold mechanics do not match reality.

**Useful references still held here:**
- Per-task verification map structure (VALIDATION.md §Per-Task Verification Map) — the idea ports to the hybrid plans even if specific rows need regeneration.
- Plan 06-01 spike scaffold (scripts/spike-bd-primitives.sh pattern) — the hybrid-path spike still needs to run, just targeted at sibling's existing bd-using code.
- D-TXN-SPIKE dual-outcome acceptance criteria — still applicable; extraction widened to a third outcome (file-snapshot restore per sibling D-11).
- D-MAPPING 4-variant `StateWriteOutcome` coverage grep patterns — port wholesale; sibling's `recordStateEvent` returns a different shape that must be migrated to ours.

**Carry-forward authoritative source:** `./.claude/skills/spike-findings-gsd-beads/` (in the fork, not here).

**Sibling archive-branch:** Phase 6's new Plan 01 will create `archive-v0.2-shadow-full-history` (or similar) on the sibling before reset-and-repurpose. Old sibling history will be preserved there.
