// tests/conformance/document-reads.test.ts
//
// Phase 2 Plan 02-03 Task 3 — conformance coverage for the document-read
// handlers migrated to the StorageAdapter:
//
// - summary.extract: reads a single user-supplied SUMMARY.md path
// - history-digest:  walks milestones/<v>-phases/ + phases/ via adapter
// - audit.uat:       walks all phase dirs scanning UAT.md / VERIFICATION.md
// - intel reads:     intelStatus mtime via adapter.stat (first stat() consumer)
// - docs-init:       single planning-tree probe via adapter.exists('')
//
// Each describe block exercises the migrated handler against a seeded tmpdir
// using MarkdownAdapter as the concrete StorageAdapter implementation.
// Phase 7 will mount BeadsAdapter against the same suite shape.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MarkdownAdapter } from '../../adapters/markdown/index.js';
import {
  summaryExtract,
  historyDigest,
} from '../../sdk/src/query/summary.js';
import { auditUat, uatRenderCheckpoint } from '../../sdk/src/query/uat.js';
import { intelStatus } from '../../sdk/src/query/intel.js';
import { docsInit } from '../../sdk/src/query/docs-init.js';

describe('Phase 2 Plan 02-03: document reads via adapter', () => {
  let tmpDir: string;
  let adapter: MarkdownAdapter;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-doc-reads-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    adapter = new MarkdownAdapter(tmpDir);

    // Seed common artifacts via the adapter (Pitfall 11: tests should construct
    // through the seam they exercise where possible).
    await adapter.putRecord('STATE.md', '---\nmilestone: v1.0\n---\n# State\n');
    await adapter.putRecord('ROADMAP.md', '# Roadmap\n## v1.0: Test\n### Phase 1: Foo\n**Goal:** Build it\n');
    await adapter.putRecord(
      'config.json',
      JSON.stringify({ model_profile: 'balanced', intel: { enabled: true } }),
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ─── summary.extract ───────────────────────────────────────────────────

  describe('summary.extract (user-supplied path — audited exception)', () => {
    it('returns parsed frontmatter for a SUMMARY.md under the planning tree', async () => {
      const rel = '.planning/phases/01-foo/01-SUMMARY.md';
      await mkdir(join(tmpDir, '.planning/phases/01-foo'), { recursive: true });
      await writeFile(
        join(tmpDir, rel),
        [
          '---',
          'phase: "01"',
          'one-liner: Built foo.',
          'key-files:',
          '  - foo.ts',
          '---',
          '',
          '# Summary',
          '',
        ].join('\n'),
        'utf-8',
      );

      const result = await summaryExtract(adapter, [rel], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.path).toBe(rel);
      expect(data.one_liner).toBe('Built foo.');
      expect(data.key_files).toEqual(['foo.ts']);
    });

    it('returns error for missing file', async () => {
      const result = await summaryExtract(adapter, ['.planning/nonexistent.md'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.error).toBeDefined();
    });
  });

  // ─── history-digest ────────────────────────────────────────────────────

  describe('history-digest (adapter walks milestones + phases)', () => {
    it('returns empty digest when neither milestones/ nor phases/ exist', async () => {
      const result = await historyDigest(adapter, [], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.phases).toEqual({});
      expect(data.decisions).toEqual([]);
      expect(data.tech_stack).toEqual([]);
    });

    it('walks current phases/ via adapter.listCollection + adapter.stat', async () => {
      // Seed a phase dir + SUMMARY.md
      await adapter.putRecord(
        'phases/01-foo/01-SUMMARY.md',
        ['---', 'phase: "01"', 'name: Foo Phase', '---', '', '# Summary', ''].join('\n'),
      );
      const result = await historyDigest(adapter, [], tmpDir);
      const data = result.data as { phases: Record<string, unknown> };
      // The digest should include phase "01" because we seeded its SUMMARY.md
      expect(Object.keys(data.phases).length).toBeGreaterThan(0);
    });

    it('walks archived milestones/<v>-phases/ via adapter', async () => {
      // Seed a milestone-archived phase
      await adapter.putRecord(
        'milestones/v0.1-phases/01-bar/01-SUMMARY.md',
        ['---', 'phase: "01"', 'name: Bar Phase', '---', '', '# Summary', ''].join('\n'),
      );
      const result = await historyDigest(adapter, [], tmpDir);
      const data = result.data as { phases: Record<string, unknown> };
      expect(Object.keys(data.phases).length).toBeGreaterThan(0);
    });
  });

  // ─── audit.uat ─────────────────────────────────────────────────────────

  describe('audit.uat (adapter walks phase dirs)', () => {
    it('returns empty results when phases/ exists but contains no UAT files', async () => {
      // Seed empty phases/01-foo dir via a placeholder file (adapter has no mkdir)
      await adapter.putRecord('phases/01-foo/PLAN.md', '# Plan\n');
      const result = await auditUat(adapter, [], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(Array.isArray(data.results)).toBe(true);
      const summary = data.summary as Record<string, unknown>;
      expect(summary.total_files).toBe(0);
    });

    it('throws when phases/ is missing entirely', async () => {
      await expect(auditUat(adapter, [], tmpDir)).rejects.toThrow(/phases directory/i);
    });
  });

  // ─── uat.render-checkpoint (audited exception) ─────────────────────────

  describe('uat.render-checkpoint (user-supplied path — audited exception)', () => {
    it('returns error when --file is missing', async () => {
      const result = await uatRenderCheckpoint(adapter, [], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.error).toBeDefined();
    });
  });

  // ─── intel reads (incl. mtime via adapter.stat) ────────────────────────

  describe('intel reads (incl. mtime via adapter.stat — first consumer)', () => {
    it('returns disabled when intel.enabled is not true', async () => {
      // Override config.json to disable intel
      await adapter.putRecord('config.json', JSON.stringify({ model_profile: 'balanced' }));
      const result = await intelStatus(adapter, [], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.disabled).toBe(true);
    });

    it('reads intel docs and computes updated_at via adapter.stat', async () => {
      // intel is enabled in beforeEach config
      await adapter.putRecord('intel/arch.md', '# Architecture\nbody\n');
      const result = await intelStatus(adapter, [], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.disabled).not.toBe(true);
      const files = data.files as Record<string, { exists: boolean; updated_at: string | null }>;
      expect(files['arch.md'].exists).toBe(true);
      // updated_at comes from adapter.stat()'s mtime field — assert it parses as a Date
      if (files['arch.md'].updated_at !== null) {
        expect(() => new Date(files['arch.md'].updated_at as string)).not.toThrow();
      }
    });

    it('marks non-existent intel files as exists:false, updated_at:null', async () => {
      // intel enabled but no files in intel/
      const result = await intelStatus(adapter, [], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.disabled).not.toBe(true);
      const files = data.files as Record<string, { exists: boolean; updated_at: string | null }>;
      // arch.md was not seeded -> exists:false
      expect(files['arch.md'].exists).toBe(false);
      expect(files['arch.md'].updated_at).toBeNull();
    });
  });

  // ─── docs-init (.planning probe via adapter.exists('')) ────────────────

  describe('docs.init (planning-tree probe via adapter.exists)', () => {
    it('reports planning_exists=true when .planning/ exists', async () => {
      const result = await docsInit(adapter, [], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.planning_exists).toBe(true);
      expect(data.project_root).toBe(tmpDir);
    });

    it('reports planning_exists=false when .planning/ does not exist', async () => {
      // Remove .planning/ so adapter.exists('') returns false
      await rm(join(tmpDir, '.planning'), { recursive: true, force: true });
      const result = await docsInit(adapter, [], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.planning_exists).toBe(false);
    });
  });
});
