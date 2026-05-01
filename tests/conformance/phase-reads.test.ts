/**
 * Phase 2 Plan 02-02 Task 3 — Conformance test for phase/state/progress/roadmap reads.
 *
 * Per-handler reproductive tests that exercise each migrated handler from Plan 02-02
 * (Tasks 1 + 2) end-to-end through the registry, against a seeded `.planning/` tree
 * served by MarkdownAdapter. Every test depends only on adapter.* — no raw fs reads
 * inside the test body — so when Phase 7 adds BeadsAdapter the same suite runs
 * unchanged with `BeadsAdapter` swapped in (per `runAdapterConformanceSuite`'s
 * locked signature).
 *
 * Read-side coverage matrix:
 *   - findPhase                      — find-phase
 *   - phasePlanIndex                 — phase-plan-index
 *   - roadmapAnalyze                 — roadmap.analyze
 *   - roadmapGetPhase                — roadmap.get-phase
 *   - progressJson                   — progress.json
 *   - auditOpen                      — audit-open
 *   - checkPhaseReady                — check.phase-ready
 *   - checkVerificationStatus        — check.verification-status
 *   - detectPhaseType                — detect.phase-type
 *
 * Plus a verify.* category test (verify.phase-completeness) that exercises the
 * adapter-routed read paths in verify.ts (D-14 mixed file).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRegistry } from '../../sdk/src/query/index.js';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../adapters/types.js';

describe('Phase 2 Plan 02-02: phase/state/progress/roadmap reads via adapter', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-phase-reads-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);

    // Seed common fixture state — exercised by multiple describe blocks below.
    await adapter.putRecord(
      'STATE.md',
      `---
milestone: v1.0
milestone_name: Initial Bootstrap
current_phase: 01
---

# State

**Current Phase:** 01
**Status:** executing
**Last Activity:** 2026-04-30
`,
    );

    await adapter.putRecord(
      'ROADMAP.md',
      `# Roadmap

## v1.0: Initial Bootstrap

### Phase 1: Foundation

**Goal:** Bootstrap the storage adapter

- [x] **Phase 1: Foundation**
- [ ] **Phase 2: Wire Reads**

### Phase 2: Wire Reads

**Goal:** Migrate read handlers
**Depends on:** Phase 1
`,
    );

    await adapter.putRecord(
      'REQUIREMENTS.md',
      `# Requirements

- [x] **REQ-01** Foundation requirement
- [ ] **REQ-02** Reads requirement

| ID | Description | Status |
|----|-------------|--------|
| REQ-01 | Foundation | Complete |
| REQ-02 | Reads | Pending |
`,
    );

    // Phase 1 directory: complete (plan + summary)
    await adapter.putRecord(
      'phases/01-foundation/01-01-PLAN.md',
      `---
phase: 01-foundation
plan: 01
wave: 1
autonomous: true
---

<objective>
Foundation plan
</objective>

<tasks>
<task type="auto">
  <name>Task 1</name>
</task>
</tasks>
`,
    );
    await adapter.putRecord('phases/01-foundation/01-01-SUMMARY.md', '# Summary\n');
    await adapter.putRecord('phases/01-foundation/01-CONTEXT.md', '# Context\n');
    await adapter.putRecord('phases/01-foundation/01-RESEARCH.md', '# Research\n');
    await adapter.putRecord(
      'phases/01-foundation/01-VERIFICATION.md',
      `---
status: passed
---

# Verification

| ID | Description | Status |
|----|-------------|--------|
| V-1 | Build passes | PASS  |
| V-2 | Tests pass   | PASS  |
`,
    );

    // Phase 2 directory: planned but not executed
    await adapter.putRecord(
      'phases/02-wire-reads/02-01-PLAN.md',
      `---
phase: 02-wire-reads
plan: 01
wave: 1
autonomous: true
---

<objective>
Wire reads
</objective>

<tasks>
<task type="auto">
  <name>Task 1</name>
</task>
</tasks>
`,
    );
    await adapter.putRecord('phases/02-wire-reads/02-CONTEXT.md', '# Context\n');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('findPhase (find-phase)', () => {
    it('finds phase 01 via adapter listCollection', async () => {
      const registry = createRegistry({ adapter });
      const result = await registry.dispatch('find-phase', ['1'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.found).toBe(true);
      expect(data.phase_number).toBe('01');
      expect(data.phase_name).toBe('foundation');
      expect((data.plans as string[]).length).toBe(1);
      expect((data.summaries as string[]).length).toBe(1);
      expect(data.has_research).toBe(true);
      expect(data.has_context).toBe(true);
      expect(data.has_verification).toBe(true);
    });

    it('returns not-found for non-existent phase', async () => {
      const registry = createRegistry({ adapter });
      const result = await registry.dispatch('find-phase', ['99'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.found).toBe(false);
      expect(data.directory).toBeNull();
      expect(data.plans).toEqual([]);
    });
  });

  describe('phasePlanIndex (phase-plan-index)', () => {
    it('lists plans in phase 01 with wave grouping', async () => {
      const registry = createRegistry({ adapter });
      const result = await registry.dispatch('phase-plan-index', ['1'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.phase).toBe('01');
      const plans = data.plans as Array<Record<string, unknown>>;
      expect(plans.length).toBe(1);
      expect(plans[0].id).toBe('01-01');
      expect(plans[0].has_summary).toBe(true);
      const waves = data.waves as Record<string, string[]>;
      expect(waves['1']).toContain('01-01');
    });

    it('returns error for non-existent phase', async () => {
      const registry = createRegistry({ adapter });
      const result = await registry.dispatch('phase-plan-index', ['99'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.error).toBe('Phase not found');
    });
  });

  describe('roadmapGetPhase (roadmap.get-phase)', () => {
    it('reads ROADMAP.md via adapter and extracts phase 1', async () => {
      const registry = createRegistry({ adapter });
      const result = await registry.dispatch('roadmap.get-phase', ['1'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.found).toBe(true);
      expect(data.phase_number).toBe('1');
      expect(data.phase_name).toBe('Foundation');
      expect(data.goal).toBe('Bootstrap the storage adapter');
    });
  });

  describe('roadmapAnalyze (roadmap.analyze)', () => {
    it('analyzes ROADMAP via adapter; returns phases array with disk correlation', async () => {
      const registry = createRegistry({ adapter });
      const result = await registry.dispatch('roadmap.analyze', [], tmpDir);
      const data = result.data as Record<string, unknown>;
      const phases = data.phases as Array<Record<string, unknown>>;
      expect(phases.length).toBeGreaterThanOrEqual(2);
      // Phase 1 should be marked complete via roadmap_complete or disk_status
      const p1 = phases.find(p => String(p.number) === '1');
      expect(p1).toBeDefined();
      // Phase 2 should be planned (has plan, no summary)
      const p2 = phases.find(p => String(p.number) === '2');
      expect(p2).toBeDefined();
    });
  });

  describe('progressJson (progress.json)', () => {
    it('reads progress via adapter; aggregates per-phase plans/summaries', async () => {
      const registry = createRegistry({ adapter });
      const result = await registry.dispatch('progress.json', [], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.total_plans).toBe(2);
      expect(data.total_summaries).toBe(1);
      expect(data.percent).toBe(50);
      const phases = data.phases as Array<Record<string, unknown>>;
      expect(phases.length).toBe(2);
    });
  });

  describe('auditOpen (audit-open)', () => {
    it('scans 8 artifact categories via adapter listCollection', async () => {
      // Seed a pending todo, an open thread, and a debug session
      await adapter.putRecord(
        'todos/pending/example.md',
        `---
priority: high
area: testing
---

Pending todo body
`,
      );
      await adapter.putRecord(
        'threads/active.md',
        `---
status: open
title: Active thread
---

# Thread: Active thread
## Status: OPEN
`,
      );
      await adapter.putRecord(
        'debug/active-session.md',
        `---
status: investigating
---

## Current Focus

Hypothesis under test
`,
      );

      const registry = createRegistry({ adapter });
      const result = await registry.dispatch('audit-open', ['--json'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.scanned_at).toBeDefined();
      const counts = data.counts as Record<string, number>;
      expect(counts.todos).toBeGreaterThanOrEqual(1);
      expect(counts.threads).toBeGreaterThanOrEqual(1);
      expect(counts.debug_sessions).toBeGreaterThanOrEqual(1);
      expect(counts.total).toBeGreaterThanOrEqual(3);
    });

    it('returns has_open_items=false for an empty .planning/ tree', async () => {
      // Nuke the seeded fixture, leave only .planning/
      await rm(join(tmpDir, '.planning'), { recursive: true, force: true });
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      const freshAdapter = new MarkdownAdapter(tmpDir);

      const registry = createRegistry({ adapter: freshAdapter });
      const result = await registry.dispatch('audit-open', ['--json'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.has_open_items).toBe(false);
    });
  });

  describe('checkPhaseReady (check.phase-ready)', () => {
    it('checks phase 01 readiness via adapter', async () => {
      const registry = createRegistry({ adapter });
      const result = await registry.dispatch('check.phase-ready', ['1'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.found).toBe(true);
      expect(data.has_context).toBe(true);
      expect(data.has_research).toBe(true);
      expect(data.has_verification).toBe(true);
      expect(data.dependencies_met).toBe(true);
    });

    it('returns discuss next_step for non-existent phase', async () => {
      const registry = createRegistry({ adapter });
      const result = await registry.dispatch('check.phase-ready', ['99'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.found).toBe(false);
      expect(data.next_step).toBe('discuss');
    });
  });

  describe('checkVerificationStatus (check.verification-status)', () => {
    it('parses VERIFICATION.md table via adapter; reports pass status', async () => {
      const registry = createRegistry({ adapter });
      const result = await registry.dispatch('check.verification-status', ['1'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.status).toBe('pass');
      expect(data.score).toBe('2/2');
      expect(data.gaps).toEqual([]);
    });

    it('returns missing for phase without VERIFICATION.md', async () => {
      const registry = createRegistry({ adapter });
      const result = await registry.dispatch('check.verification-status', ['2'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.status).toBe('missing');
    });
  });

  describe('detectPhaseType (detect.phase-type)', () => {
    it('detects phase 01 type via adapter recursive list', async () => {
      const registry = createRegistry({ adapter });
      const result = await registry.dispatch('detect.phase-type', ['1'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.phase).toBe('01');
      // No UI/schema/api/infra signals in the seeded fixture
      expect(data.has_frontend).toBe(false);
      expect(data.has_schema).toBe(false);
      expect(data.has_api).toBe(false);
      expect(data.has_infra).toBe(false);
    });

    it('detects UI signals from a UI-SPEC.md file via listCollection', async () => {
      // Seed a UI-SPEC.md file in phase 01
      await adapter.putRecord('phases/01-foundation/01-UI-SPEC.md', '# UI\n');
      const registry = createRegistry({ adapter });
      const result = await registry.dispatch('detect.phase-type', ['1'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.has_frontend).toBe(true);
    });
  });

  describe('verify.phase-completeness (read paths via adapter)', () => {
    it('reports phase 01 as complete (plan + summary) via adapter listCollection', async () => {
      const registry = createRegistry({ adapter });
      const result = await registry.dispatch('verify.phase-completeness', ['1'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.complete).toBe(true);
      expect(data.plan_count).toBe(1);
      expect(data.summary_count).toBe(1);
      expect(data.incomplete_plans).toEqual([]);
    });

    it('reports phase 02 as incomplete (plan, no summary)', async () => {
      const registry = createRegistry({ adapter });
      const result = await registry.dispatch('verify.phase-completeness', ['2'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.complete).toBe(false);
      expect(data.plan_count).toBe(1);
      expect(data.summary_count).toBe(0);
      expect((data.incomplete_plans as string[]).length).toBe(1);
    });
  });
});
