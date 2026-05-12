/**
 * Phase 3 Plan 05 — Conformance tests for recordStateAppend/Mutation/Signal.
 * Verifies event family round-trips produce correct STATE.md content.
 *
 * Each event family is tested via adapter calls only (no direct fs reads).
 * Phase 7 swaps MarkdownAdapter for BeadsAdapter and runs unchanged.
 *
 * File renamed from *.test.ts to *.conformance-suite.ts so vitest's
 * default test-file glob does NOT pick it up directly — preventing
 * double-registration (WARNING #1 resolution).
 *
 * Phase 7 Plan 07-04b: migrated from MarkdownAdapter-only to accept an
 * adapterFactory parameter. Invoked per adapter from paired.test.ts's
 * `pairedAdapters` loop. Per-adapter expected outcomes live in
 * CONFORMANCE_MANIFEST (manifest.ts populates).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StorageAdapter } from '../../adapters/types.js';
import type { AdapterName, ExpectedOutcome } from './manifest-types.js';
import { assertFromManifest, preRegisterTest } from './test-registry.js';

/**
 * Compare actual outcome to manifest expected, normalizing `created_section: null`.
 *
 * D-2026-05-12-OQ06-CREATED-SECTION: BeadsAdapter Outcome A never emits
 * `created_section`. Manifest entries encode this as `created_section: null`.
 * Actual BeadsAdapter outcomes omit the key entirely. This helper strips
 * `created_section: null` before `toEqual` comparison.
 */
function expectOutcomeMatch(actual: unknown, expected: ExpectedOutcome): void {
  if (
    actual !== null &&
    typeof actual === 'object' &&
    expected !== null &&
    typeof expected === 'object' &&
    'created_section' in expected &&
    (expected as { created_section: unknown }).created_section === null
  ) {
    const { created_section: _cs, ...rest } = expected as Record<string, unknown>;
    void _cs;
    expect(actual).toEqual(rest);
  } else {
    expect(actual).toEqual(expected);
  }
}

export function runStateEventDispatchSuite(
  adapterName: AdapterName,
  adapterFactory: (projectDir: string) => StorageAdapter,
): void {
  // Pre-register all section-tuple entries for this suite at COLLECTION time.
  // binB entries in this suite use assertFromManifest with presence-only checks
  // (no binB entries are exclusively registered here; section-tuples are).
  const eventEntries: Array<{ name: string; kind: 'binB' | 'section-tuple' }> = [
    { name: 'STATE.md#Decisions Made:append', kind: 'section-tuple' },
    { name: 'STATE.md#Performance Metrics:append', kind: 'section-tuple' },
    { name: 'STATE.md#Quick Tasks:append', kind: 'section-tuple' },
    { name: 'STATE.md#Forensic Sessions:append', kind: 'section-tuple' },
    { name: 'STATE.md#Blockers:append', kind: 'section-tuple' },
    // binB entries also registered here (shared with write-outcome for
    // recordStateAppend:metric:scaffold and recordStateMutation:blocker_added:scaffold)
    { name: 'recordStateAppend:metric:scaffold', kind: 'binB' },
    { name: 'recordStateMutation:blocker_added:scaffold', kind: 'binB' },
  ];
  for (const entry of eventEntries) {
    preRegisterTest(adapterName, entry.name, entry.kind);
  }

  describe(`recordStateAppend (${adapterName})`, () => {
    let tmpDir: string;
    let adapter: StorageAdapter;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-events-'));
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      adapter = adapterFactory(tmpDir);
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

      // MarkdownAdapter-only: BeadsAdapter stores entries in bd memory, not STATE.md.
      if (adapterName === 'markdown') {
        const content = await adapter.getRecord('STATE.md');
        expect(content).toContain('- [Phase 03]: Test decision');
        expect(content).toContain('Test rationale');
        expect(content).not.toContain('None yet');
      }
    });

    // Regression: STATE.md files in the wild use heading variants like
    // "## Locked decisions (2026-04-30)" (lowercase, suffix). The prior
    // hard-coded regex matched only the three literals "Decisions",
    // "Decisions Made", "Accumulated...Decisions", so those writes silently
    // no-op'd — the handler reported `{added: true}` while the decision
    // was dropped on the floor. Broadened to match any heading containing
    // the word decision(s) case-insensitively.
    it('appends decision entry to heading variants (lowercase, suffixed)', async () => {
      await adapter.putRecord(
        'STATE.md',
        `---
milestone: v1.0
---

# State

## Locked decisions (2026-04-30)

- Original entry
`,
      );

      await adapter.recordStateAppend({
        type: 'decision',
        payload: { phase: '99', summary: 'Heading variant', rationale: 'regression' },
      });

      // MarkdownAdapter-only: BeadsAdapter stores entries in bd memory, not STATE.md.
      if (adapterName === 'markdown') {
        const content = await adapter.getRecord('STATE.md');
        expect(content).toContain('- [Phase 99]: Heading variant — regression');
        // The pre-existing entry must survive the append (not clobbered).
        expect(content).toContain('- Original entry');
      }
    });

    it('creates Decisions Made section when no decisions heading exists', async () => {
      await adapter.putRecord(
        'STATE.md',
        `---
milestone: v1.0
---

# State

## Current Position

Phase: 1
`,
      );

      await adapter.recordStateAppend({
        type: 'decision',
        payload: { phase: '01', summary: 'First decision', rationale: null },
      });

      // MarkdownAdapter-only: BeadsAdapter stores entries in bd memory, not STATE.md.
      if (adapterName === 'markdown') {
        const content = await adapter.getRecord('STATE.md');
        expect(content).toContain('## Decisions Made');
        expect(content).toContain('- [Phase 01]: First decision');
        // Existing content preserved.
        expect(content).toContain('## Current Position');
      }
      // Register as section-tuple: STATE.md#Decisions Made creation
      assertFromManifest(adapterName, 'STATE.md#Decisions Made:append', 'section-tuple', (expected) => {
        expect(expected).toBeTruthy();
      });
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

      // MarkdownAdapter-only: BeadsAdapter stores entries in bd memory, not STATE.md.
      if (adapterName === 'markdown') {
        const content = await adapter.getRecord('STATE.md');
        expect(content).toContain('Phase 03 P05');
        expect(content).toContain('12m');
        expect(content).toContain('3 tasks');
        expect(content).toContain('5 files');
      }
    });

    // Regression: before the fix, a metric event against a STATE.md without
    // a Performance Metrics section silently no-op'd — the handler reported
    // {recorded: true} while the row was dropped. Create-if-missing scaffolds
    // both the section and the table header.
    it('creates Performance Metrics section when none exists', async () => {
      await adapter.putRecord(
        'STATE.md',
        `---
milestone: v1.0
---

# State

## Current Position

Phase: 1
`,
      );

      const outcome = await adapter.recordStateAppend({
        type: 'metric',
        payload: { phase: '03', plan: '05', duration: '12m', tasks: '3', files: '5' },
      });

      // Phase 3 UAT scar (commit 08b4054a): create-if-missing surfaces via typed
      // created_section field per D-2026-05-10-08.
      assertFromManifest(adapterName, 'recordStateAppend:metric:scaffold', 'binB', (expected) => {
        expectOutcomeMatch(outcome, expected);
      });
      // Also register as section-tuple: STATE.md#Performance Metrics creation
      assertFromManifest(adapterName, 'STATE.md#Performance Metrics:append', 'section-tuple', (expected) => {
        expect(expected).toBeTruthy();
      });

      // MarkdownAdapter-only: BeadsAdapter stores entries in bd memory, not STATE.md.
      if (adapterName === 'markdown') {
        const content = await adapter.getRecord('STATE.md');
        expect(content).toContain('## Performance Metrics');
        expect(content).toContain('Phase 03 P05');
        expect(content).toContain('12m');
        // Pre-existing content preserved.
        expect(content).toContain('## Current Position');
      }
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

      // MarkdownAdapter-only: BeadsAdapter stores entries in bd memory, not STATE.md.
      if (adapterName === 'markdown') {
        const content = await adapter.getRecord('STATE.md');
        expect(content).toContain('Phase 4a inserted after Phase 4');
        expect(content).toContain('Hotfix phase');
        expect(content).not.toContain('None yet');
      }
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

      // MarkdownAdapter-only: BeadsAdapter stores session data in bd memory, not STATE.md.
      if (adapterName === 'markdown') {
        const content = await adapter.getRecord('STATE.md');
        expect(content).toContain('Phase 3 Plan 05 task 1');
        expect(content).toContain('03-05-PLAN.md');
        // Session timestamp should be updated (ISO format)
        expect(content).toMatch(/Last session: \d{4}-\d{2}-\d{2}T/);
      }
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

      // MarkdownAdapter-only: BeadsAdapter stores entries in bd memory, not STATE.md.
      if (adapterName === 'markdown') {
        const content = await adapter.getRecord('STATE.md');
        expect(content).toContain('## Quick Tasks');
        expect(content).toContain('- Fix typo in README: done');
      }
      // Register as section-tuple: STATE.md#Quick Tasks creation
      assertFromManifest(adapterName, 'STATE.md#Quick Tasks:append', 'section-tuple', (expected) => {
        expect(expected).toBeTruthy();
      });
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

      // MarkdownAdapter-only: BeadsAdapter stores entries in bd memory, not STATE.md.
      if (adapterName === 'markdown') {
        const content = await adapter.getRecord('STATE.md');
        expect(content).toContain('## Forensic Sessions');
        expect(content).toContain('- FS-001: Found root cause of flaky test');
      }
      // Register as section-tuple: STATE.md#Forensic Sessions creation
      assertFromManifest(adapterName, 'STATE.md#Forensic Sessions:append', 'section-tuple', (expected) => {
        expect(expected).toBeTruthy();
      });
    });
  });

  describe(`recordStateMutation (${adapterName})`, () => {
    let tmpDir: string;
    let adapter: StorageAdapter;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-events-'));
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      adapter = adapterFactory(tmpDir);
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

      // MarkdownAdapter-only: BeadsAdapter stores blockers in bd labels, not STATE.md.
      if (adapterName === 'markdown') {
        const content = await adapter.getRecord('STATE.md');
        expect(content).toContain('- Need API key');
      }
    });

    // Regression: before the fix, a blocker_added event against a STATE.md
    // without a Blockers section silently no-op'd — the handler reported
    // {added: true} while the entry was dropped.
    it('creates Blockers section when none exists (blocker_added)', async () => {
      await adapter.putRecord(
        'STATE.md',
        `---
milestone: v1.0
---

# State

## Current Position

Phase: 1
`,
      );

      const outcome = await adapter.recordStateMutation({
        type: 'blocker_added',
        payload: { text: 'Missing env var' },
      });

      // Phase 3 UAT scar (commit 08b4054a): create-if-missing surfaces via typed
      // created_section field per D-2026-05-10-08.
      assertFromManifest(adapterName, 'recordStateMutation:blocker_added:scaffold', 'binB', (expected) => {
        expectOutcomeMatch(outcome, expected);
      });
      // Also register as section-tuple: STATE.md#Blockers creation
      assertFromManifest(adapterName, 'STATE.md#Blockers:append', 'section-tuple', (expected) => {
        expect(expected).toBeTruthy();
      });

      // MarkdownAdapter-only: BeadsAdapter stores blockers in bd labels, not STATE.md.
      if (adapterName === 'markdown') {
        const content = await adapter.getRecord('STATE.md');
        expect(content).toContain('## Blockers');
        expect(content).toContain('- Missing env var');
        // Pre-existing content preserved.
        expect(content).toContain('## Current Position');
      }
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

      // MarkdownAdapter-only: BeadsAdapter uses bd labels for blockers, not STATE.md.
      if (adapterName === 'markdown') {
        const content = await adapter.getRecord('STATE.md');
        expect(content).not.toContain('- Need API key');
        expect(content).toContain('Waiting for deploy');
      }
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

      // MarkdownAdapter-only: BeadsAdapter stores todo count in bd memory, not STATE.md.
      if (adapterName === 'markdown') {
        const content = await adapter.getRecord('STATE.md');
        expect(content).toContain('(5 items)');
      }
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

      // MarkdownAdapter-only: BeadsAdapter stores deferred items in bd memory, not STATE.md.
      if (adapterName === 'markdown') {
        const content = await adapter.getRecord('STATE.md');
        expect(content).toContain('- Plugin system');
        expect(content).toContain('- REST API');
      }
    });
  });

  describe(`recordStateSignal (${adapterName})`, () => {
    let tmpDir: string;
    let adapter: StorageAdapter;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'gsd-write-events-'));
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      adapter = adapterFactory(tmpDir);
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('creates WAITING.json on waiting signal', async () => {
      await adapter.recordStateSignal({
        type: 'waiting',
        payload: { waitType: 'checkpoint', question: 'Looks good?' },
      });

      // MarkdownAdapter-only: BeadsAdapter uses bd labels for waiting signals,
      // not WAITING.json, so getRecord('WAITING.json') returns null.
      if (adapterName === 'markdown') {
        const content = await adapter.getRecord('WAITING.json');
        expect(content).not.toBeNull();
        const parsed = JSON.parse(content!);
        expect(parsed.status).toBe('waiting');
        expect(parsed.type).toBe('checkpoint');
        expect(parsed.question).toBe('Looks good?');
        expect(parsed.since).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
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

      // MarkdownAdapter-only: BeadsAdapter uses bd labels for resume signals;
      // WAITING.json seeded via putRecord is not visible to bd resume logic.
      if (adapterName === 'markdown') {
        const content = await adapter.getRecord('WAITING.json');
        expect(content).toBeNull();
      }
    });
  });
}
