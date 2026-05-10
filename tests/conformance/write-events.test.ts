/**
 * Phase 3 Plan 05 — Conformance tests for recordStateAppend/Mutation/Signal.
 * Verifies event family round-trips produce correct STATE.md content.
 *
 * Each event family is tested via adapter calls only (no direct fs reads).
 * Phase 7 swaps MarkdownAdapter for BeadsAdapter and runs unchanged.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import type { StorageAdapter } from '../../adapters/types.js';

describe('recordStateAppend', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-events-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('appends decision entry to Decisions section', async () => {
    await adapter.putRecord(
      'STATE.md',
      `---
milestone: v1.0
---

# State

## Decisions

None yet.
`,
    );

    await adapter.recordStateAppend({
      type: 'decision',
      payload: { phase: '03', summary: 'Test decision', rationale: 'Test rationale' },
    });

    const content = await adapter.getRecord('STATE.md');
    expect(content).toContain('- [Phase 03]: Test decision');
    expect(content).toContain('Test rationale');
    expect(content).not.toContain('None yet');
  });

  it('appends metric row to Performance Metrics table', async () => {
    await adapter.putRecord(
      'STATE.md',
      `---
milestone: v1.0
---

# State

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
`,
    );

    await adapter.recordStateAppend({
      type: 'metric',
      payload: { phase: '03', plan: '05', duration: '12m', tasks: '3', files: '5' },
    });

    const content = await adapter.getRecord('STATE.md');
    expect(content).toContain('Phase 03 P05');
    expect(content).toContain('12m');
    expect(content).toContain('3 tasks');
    expect(content).toContain('5 files');
  });

  it('appends roadmap evolution entry', async () => {
    await adapter.putRecord(
      'STATE.md',
      `---
milestone: v1.0
---

# State

## Accumulated Context

### Roadmap Evolution

None yet.
`,
    );

    await adapter.recordStateAppend({
      type: 'roadmap_evolution',
      payload: { phase: '4a', action: 'inserted', after: '4', note: 'Hotfix phase' },
    });

    const content = await adapter.getRecord('STATE.md');
    expect(content).toContain('Phase 4a inserted after Phase 4');
    expect(content).toContain('Hotfix phase');
    expect(content).not.toContain('None yet');
  });

  it('updates session continuity section', async () => {
    await adapter.putRecord(
      'STATE.md',
      `---
milestone: v1.0
---

# State

## Session Continuity

Last session: 2026-05-01T00:00:00Z
Stopped at: Phase 2 complete
Resume file: None
`,
    );

    await adapter.recordStateAppend({
      type: 'session',
      payload: { stoppedAt: 'Phase 3 Plan 05 task 1', resumeFile: '03-05-PLAN.md' },
    });

    const content = await adapter.getRecord('STATE.md');
    expect(content).toContain('Phase 3 Plan 05 task 1');
    expect(content).toContain('03-05-PLAN.md');
    // Session timestamp should be updated (ISO format)
    expect(content).toMatch(/Last session: \d{4}-\d{2}-\d{2}T/);
  });

  it('creates section if missing for quick_task', async () => {
    await adapter.putRecord(
      'STATE.md',
      `---
milestone: v1.0
---

# State

## Decisions

(none)
`,
    );

    await adapter.recordStateAppend({
      type: 'quick_task',
      payload: { task: 'Fix typo in README', result: 'done' },
    });

    const content = await adapter.getRecord('STATE.md');
    expect(content).toContain('## Quick Tasks');
    expect(content).toContain('- Fix typo in README: done');
  });

  it('appends forensic_session entry to Forensic Sessions section', async () => {
    await adapter.putRecord(
      'STATE.md',
      `---
milestone: v1.0
---

# State

## Decisions

(none)
`,
    );

    await adapter.recordStateAppend({
      type: 'forensic_session',
      payload: { sessionId: 'FS-001', findings: 'Found root cause of flaky test' },
    });

    const content = await adapter.getRecord('STATE.md');
    expect(content).toContain('## Forensic Sessions');
    expect(content).toContain('- FS-001: Found root cause of flaky test');
  });
});

describe('recordStateMutation', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-events-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('adds blocker to Blockers section', async () => {
    await adapter.putRecord(
      'STATE.md',
      `---
milestone: v1.0
---

# State

## Blockers

None
`,
    );

    await adapter.recordStateMutation({
      type: 'blocker_added',
      payload: { text: 'Need API key' },
    });

    const content = await adapter.getRecord('STATE.md');
    expect(content).toContain('- Need API key');
  });

  it('resolves blocker (removes from list)', async () => {
    await adapter.putRecord(
      'STATE.md',
      `---
milestone: v1.0
---

# State

## Blockers

- Need API key
- Waiting for deploy
`,
    );

    await adapter.recordStateMutation({
      type: 'blocker_resolved',
      payload: { text: 'Need API key' },
    });

    const content = await adapter.getRecord('STATE.md');
    expect(content).not.toContain('- Need API key');
    expect(content).toContain('Waiting for deploy');
  });

  it('updates todo count', async () => {
    await adapter.putRecord(
      'STATE.md',
      `---
milestone: v1.0
---

# State

## Pending todos

(none)
`,
    );

    await adapter.recordStateMutation({
      type: 'todo_count_update',
      payload: { count: 5 },
    });

    const content = await adapter.getRecord('STATE.md');
    expect(content).toContain('(5 items)');
  });

  it('adds deferred items to Deferred Ideas section', async () => {
    await adapter.putRecord(
      'STATE.md',
      `---
milestone: v1.0
---

# State

## Deferred Ideas

None
`,
    );

    await adapter.recordStateMutation({
      type: 'deferred_items',
      payload: { items: ['Plugin system', 'REST API'], action: 'add' },
    });

    const content = await adapter.getRecord('STATE.md');
    expect(content).toContain('- Plugin system');
    expect(content).toContain('- REST API');
  });
});

describe('recordStateSignal', () => {
  let tmpDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-events-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates WAITING.json on waiting signal', async () => {
    await adapter.recordStateSignal({
      type: 'waiting',
      payload: { waitType: 'checkpoint', question: 'Looks good?' },
    });

    const content = await adapter.getRecord('WAITING.json');
    expect(content).not.toBeNull();
    const parsed = JSON.parse(content!);
    expect(parsed.status).toBe('waiting');
    expect(parsed.type).toBe('checkpoint');
    expect(parsed.question).toBe('Looks good?');
    expect(parsed.since).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('removes WAITING.json on resume signal', async () => {
    // Seed WAITING.json
    await adapter.putRecord(
      'WAITING.json',
      JSON.stringify({ status: 'waiting', type: 'checkpoint', question: 'Test?' }),
    );

    await adapter.recordStateSignal({
      type: 'resume',
      payload: {},
    });

    const content = await adapter.getRecord('WAITING.json');
    expect(content).toBeNull();
  });
});
