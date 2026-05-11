/**
 * Phase 3 Plan 06 — StateWriteOutcome three-state contract conformance.
 *
 * Exercises every point in the StateWriteOutcome discriminated union
 * across the Append / Mutation / Signal event families. Motivated by
 * Phase 3 UAT scars (commits e7c0806a, e325d561, 08b4054a) and ADR
 * D-2026-05-10-08 (the three-state outcome contract).
 *
 * Coverage matrix (event family × outcome variant):
 *
 *   Append/decision            → applied:true bare
 *   Append/decision            → applied:true + created_section (scaffolded)
 *   Append/metric              → applied:true + created_section
 *   Append/roadmap_evolution   → applied:false + reason:'duplicate'
 *   Append/roadmap_evolution   → applied:true bare
 *   Append/roadmap_evolution   → applied:true + created_section
 *   Mutation/blocker_added     → applied:true + created_section
 *   Mutation/blocker_added     → applied:true bare
 *   Mutation/blocker_resolved  → applied:false + reason:'nothing_to_remove'
 *   Mutation/blocker_resolved  → applied:true bare
 *   Mutation/todo_count_update → applied:true + created_section
 *   Mutation/deferred_items    → applied:false + reason:'nothing_to_remove' (remove missing item)
 *   Mutation/deferred_items    → applied:true bare (add against existing section)
 *   Mutation/deferred_items    → applied:false + reason:'duplicate' (IN-02: add all-existing items)
 *   Mutation/deferred_items    → applied:true + created_section (add to STATE.md without section)
 *   Signal/waiting             → applied:true bare
 *   Signal/resume              → applied:true bare
 *   Signal/resume              → applied:false + reason:'nothing_to_remove'
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../adapters/types.js';

async function seedStateMd(adapter: StorageAdapter, body: string): Promise<void> {
  await adapter.putRecord('STATE.md', `---\nmilestone: v1.0\n---\n\n${body}`);
}

describe('recordStateAppend outcomes', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-outcome-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('decision: applied:true bare when Decisions section exists', async () => {
    await seedStateMd(adapter, '# State\n\n## Decisions Made\n\n(none)\n');

    const outcome = await adapter.recordStateAppend({
      type: 'decision',
      payload: { phase: '03', summary: 'Existing-section decision', rationale: 'test' },
    });

    expect(outcome).toEqual({ applied: true });
  });

  it('decision: applied:true + created_section when no Decisions heading', async () => {
    await seedStateMd(adapter, '# State\n\n## Current Position\n\nPhase: 1\n');

    const outcome = await adapter.recordStateAppend({
      type: 'decision',
      payload: { phase: '03', summary: 'Scaffolding decision', rationale: 'test' },
    });

    expect(outcome).toEqual({ applied: true, created_section: '## Decisions Made' });
  });

  it('metric: applied:true + created_section scaffolds Performance Metrics', async () => {
    await seedStateMd(adapter, '# State\n\n## Current Position\n\nPhase: 1\n');

    const outcome = await adapter.recordStateAppend({
      type: 'metric',
      payload: { phase: '03', plan: '06', duration: '15m', tasks: '9', files: '6' },
    });

    expect(outcome).toEqual({ applied: true, created_section: '## Performance Metrics' });
  });

  // WR-04: cover the applied:true bare path (table already exists — no scaffold).
  it('metric: applied:true bare when Performance Metrics table exists', async () => {
    await seedStateMd(
      adapter,
      [
        '# State',
        '',
        '## Performance Metrics',
        '',
        '| Phase/Plan | Duration | Tasks | Files |',
        '|-----------|----------|-------|-------|',
        '| None yet |  |  |  |',
        '',
      ].join('\n'),
    );

    const outcome = await adapter.recordStateAppend({
      type: 'metric',
      payload: { phase: '03', plan: '06', duration: '15m', tasks: '9', files: '6' },
    });

    expect(outcome).toEqual({ applied: true });
  });

  // WR-04: Append/session outcome coverage.
  it('session: applied:true bare when Last session field exists', async () => {
    await seedStateMd(
      adapter,
      [
        '# State',
        '',
        '## Session Continuity',
        '',
        'Last session: 2026-05-01T00:00:00Z',
        'Resume File: None',
        '',
      ].join('\n'),
    );

    const outcome = await adapter.recordStateAppend({
      type: 'session',
      payload: { resumeFile: 'plan.md' },
    });

    expect(outcome).toEqual({ applied: true });
  });

  it('session: applied:true + created_section when no session field present', async () => {
    await seedStateMd(adapter, '# State\n\n## Current Position\n\nPhase: 1\n');

    const outcome = await adapter.recordStateAppend({
      type: 'session',
      payload: { stoppedAt: 'PLAN-01 step 3', resumeFile: 'plan.md' },
    });

    expect(outcome).toEqual({ applied: true, created_section: '## Session Continuity' });
  });

  it('roadmap_evolution: applied:false + reason:duplicate on exact re-append', async () => {
    // Seed with the exact line the roadmap_evolution formatter will produce.
    await seedStateMd(
      adapter,
      '# State\n\n## Accumulated Context\n\n### Roadmap Evolution\n\n- Phase 3 added: Test entry\n',
    );

    const outcome = await adapter.recordStateAppend({
      type: 'roadmap_evolution',
      payload: { phase: '3', action: 'added', note: 'Test entry' },
    });

    expect(outcome).toEqual({ applied: false, reason: 'duplicate' });
  });

  it('roadmap_evolution: applied:true bare on new entry to existing subsection', async () => {
    await seedStateMd(
      adapter,
      '# State\n\n## Accumulated Context\n\n### Roadmap Evolution\n\nNone yet.\n',
    );

    const outcome = await adapter.recordStateAppend({
      type: 'roadmap_evolution',
      payload: { phase: '4', action: 'added', note: 'fresh entry' },
    });

    expect(outcome).toEqual({ applied: true });
  });

  it('roadmap_evolution: applied:true + created_section when subsection absent', async () => {
    await seedStateMd(adapter, '# State\n\n## Current Position\n\nPhase: 1\n');

    const outcome = await adapter.recordStateAppend({
      type: 'roadmap_evolution',
      payload: { phase: '4a', action: 'inserted', after: '4', note: 'hotfix' },
    });

    expect(outcome).toEqual({ applied: true, created_section: '### Roadmap Evolution' });
  });

  // WR-02 regression: dedupe scope is scoped to `### Roadmap Evolution`, not
  // the whole file. An identical bullet line present outside that subsection
  // (e.g., under `## Decisions Made`) must NOT block the write.
  // Documents D-2026-05-10-08 "Consequences" scope-change entry.
  it('roadmap_evolution: applied:true when identical bullet exists OUTSIDE Roadmap Evolution', async () => {
    await seedStateMd(
      adapter,
      [
        '# State',
        '',
        '## Decisions Made',
        '',
        // An identical bullet under a different section — pre-03-06 caller-side
        // dedupe would have seen this and refused the write.
        '- Phase 3 added: Test entry',
        '',
        '## Accumulated Context',
        '',
        '### Roadmap Evolution',
        '',
        'None yet.',
        '',
      ].join('\n'),
    );

    const outcome = await adapter.recordStateAppend({
      type: 'roadmap_evolution',
      payload: { phase: '3', action: 'added', note: 'Test entry' },
    });

    expect(outcome).toEqual({ applied: true });
    // Sanity: the new entry lands in the Roadmap Evolution subsection.
    const content = await adapter.getRecord('STATE.md');
    expect(content).toContain('### Roadmap Evolution');
    expect(content).toMatch(/### Roadmap Evolution[\s\S]*- Phase 3 added: Test entry/);
  });
});

describe('recordStateMutation outcomes', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-outcome-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('blocker_added: applied:true + created_section on STATE.md without Blockers', async () => {
    await seedStateMd(adapter, '# State\n\n## Current Position\n\nPhase: 1\n');

    const outcome = await adapter.recordStateMutation({
      type: 'blocker_added',
      payload: { text: 'scaffold me' },
    });

    expect(outcome).toEqual({ applied: true, created_section: '## Blockers' });
  });

  it('blocker_added: applied:true bare when Blockers section exists', async () => {
    await seedStateMd(adapter, '# State\n\n## Blockers\n\nNone\n');

    const outcome = await adapter.recordStateMutation({
      type: 'blocker_added',
      payload: { text: 'existing-section blocker' },
    });

    expect(outcome).toEqual({ applied: true });
  });

  it('blocker_resolved: applied:false + reason:nothing_to_remove when blocker absent', async () => {
    await seedStateMd(adapter, '# State\n\n## Current Position\n\nPhase: 1\n');

    const outcome = await adapter.recordStateMutation({
      type: 'blocker_resolved',
      payload: { text: 'nonexistent blocker' },
    });

    expect(outcome).toEqual({ applied: false, reason: 'nothing_to_remove' });
  });

  it('blocker_resolved: applied:true when blocker present', async () => {
    await seedStateMd(adapter, '# State\n\n## Blockers\n\n- Need API key\n');

    const outcome = await adapter.recordStateMutation({
      type: 'blocker_resolved',
      payload: { text: 'Need API key' },
    });

    expect(outcome).toEqual({ applied: true });
  });

  // WR-04: cover the section-exists-but-blocker-absent branch in
  // removeFromBlockersList (adapters/markdown/index.ts `filtered.length
  // === lines.length` short-circuit). A section-absent test already covers
  // the other nothing_to_remove branch; this one guards the short-circuit.
  it('blocker_resolved: applied:false + reason:nothing_to_remove when section exists but named blocker absent', async () => {
    await seedStateMd(adapter, '# State\n\n## Blockers\n\n- Other blocker\n');

    const outcome = await adapter.recordStateMutation({
      type: 'blocker_resolved',
      payload: { text: 'Does not exist' },
    });

    expect(outcome).toEqual({ applied: false, reason: 'nothing_to_remove' });

    // And the existing blocker must still be present (no accidental clobber).
    const content = await adapter.getRecord('STATE.md');
    expect(content).toContain('- Other blocker');
  });

  it('todo_count_update: applied:true + created_section when Pending todos absent', async () => {
    await seedStateMd(adapter, '# State\n\n## Current Position\n\nPhase: 1\n');

    const outcome = await adapter.recordStateMutation({
      type: 'todo_count_update',
      payload: { count: 3 },
    });

    expect(outcome).toEqual({ applied: true, created_section: '## Pending todos' });
  });

  // WR-04: cover the applied:true bare path (section already exists).
  it('todo_count_update: applied:true bare when Pending todos section exists', async () => {
    await seedStateMd(adapter, '# State\n\n## Pending todos\n\n(none)\n');

    const outcome = await adapter.recordStateMutation({
      type: 'todo_count_update',
      payload: { count: 5 },
    });

    expect(outcome).toEqual({ applied: true });
  });

  it('deferred_items remove: applied:false + reason:nothing_to_remove when item absent', async () => {
    await seedStateMd(adapter, '# State\n\n## Deferred Ideas\n\n- some other idea\n');

    const outcome = await adapter.recordStateMutation({
      type: 'deferred_items',
      payload: { items: ['nonexistent'], action: 'remove' },
    });

    expect(outcome).toEqual({ applied: false, reason: 'nothing_to_remove' });
  });

  it('deferred_items add: applied:true bare when Deferred Ideas section exists', async () => {
    await seedStateMd(adapter, '# State\n\n## Deferred Ideas\n\nNone\n');

    const outcome = await adapter.recordStateMutation({
      type: 'deferred_items',
      payload: { items: ['Plugin system'], action: 'add' },
    });

    expect(outcome).toEqual({ applied: true });
  });

  // WR-04: cover the scaffold path for deferred_items add — STATE.md without
  // a Deferred Ideas section.
  it('deferred_items add: applied:true + created_section when Deferred Ideas absent', async () => {
    await seedStateMd(adapter, '# State\n\n## Current Position\n\nPhase: 1\n');

    const outcome = await adapter.recordStateMutation({
      type: 'deferred_items',
      payload: { items: ['Plugin system'], action: 'add' },
    });

    expect(outcome).toEqual({ applied: true, created_section: '## Deferred Ideas' });
  });

  // IN-02: deferred_items add dedupes on exact-line match (parity with
  // appendToRoadmapEvolution). When EVERY requested item is already in the
  // Deferred Ideas section, the helper reports
  // {applied: false, reason: 'duplicate'}.
  it('deferred_items add: applied:false + reason:duplicate when all items already present', async () => {
    await seedStateMd(
      adapter,
      '# State\n\n## Deferred Ideas\n\n- Plugin system\n- Multi-tenant\n',
    );

    const outcome = await adapter.recordStateMutation({
      type: 'deferred_items',
      payload: { items: ['Plugin system', 'Multi-tenant'], action: 'add' },
    });

    expect(outcome).toEqual({ applied: false, reason: 'duplicate' });
  });

  // IN-02: when SOME items are duplicates and some are new, the helper
  // appends ONLY the new ones and surfaces applied:true. The
  // StateWriteOutcome contract doesn't encode a partial-duplicate signal;
  // this test locks the "drop dupes, accept the rest" semantics so future
  // refactors don't accidentally change them.
  it('deferred_items add: applied:true when some items are duplicates (only new items appended)', async () => {
    await seedStateMd(
      adapter,
      '# State\n\n## Deferred Ideas\n\n- Plugin system\n',
    );

    const outcome = await adapter.recordStateMutation({
      type: 'deferred_items',
      payload: { items: ['Plugin system', 'Multi-tenant'], action: 'add' },
    });

    expect(outcome).toEqual({ applied: true });
    const content = await adapter.getRecord('STATE.md');
    // The existing item must not be duplicated in the file.
    expect((content as string).match(/- Plugin system/g) ?? []).toHaveLength(1);
    // The new item landed.
    expect(content).toContain('- Multi-tenant');
  });
});

describe('recordStateSignal outcomes', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-outcome-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('waiting: always applied:true', async () => {
    const outcome = await adapter.recordStateSignal({
      type: 'waiting',
      payload: { waitType: 'checkpoint', question: 'Looks good?' },
    });

    expect(outcome).toEqual({ applied: true });
    // WAITING.json is a side-effect — verify it landed.
    const waiting = await adapter.getRecord('WAITING.json');
    expect(waiting).not.toBeNull();
  });

  it('resume: applied:true when WAITING.json exists', async () => {
    await adapter.putRecord(
      'WAITING.json',
      JSON.stringify({ status: 'waiting', type: 'checkpoint' }),
    );

    const outcome = await adapter.recordStateSignal({
      type: 'resume',
      payload: {},
    });

    expect(outcome).toEqual({ applied: true });
    const waiting = await adapter.getRecord('WAITING.json');
    expect(waiting).toBeNull();
  });

  it('resume: applied:false + reason:nothing_to_remove when WAITING.json absent', async () => {
    const outcome = await adapter.recordStateSignal({
      type: 'resume',
      payload: {},
    });

    expect(outcome).toEqual({ applied: false, reason: 'nothing_to_remove' });
  });
});
