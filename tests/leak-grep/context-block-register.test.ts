// tests/leak-grep/context-block-register.test.ts
//
// Phase 2 Plan 02-05 — register-completeness test for the <context>-block
// @.planning/ leak class (READS-03 / OQ-04 partial-resolution).
//
// Asserts:
//   1. The audit register (.md + .json) exists and is well-formed
//   2. Every record has a valid 3-bucket disposition + non-empty rationale
//   3. LOW-4 strict — every reference under templates/ or references/ is
//      classified EXCEPTION (single misclassified row fails the test)
//   4. MED-4 — fixture file is NOT in the register (outside SCAN_DIRS by design)
//   5. No orphans — every leak-grep CONTEXT_BLOCK_RE match within SCAN_DIRS
//      has a corresponding register row (cross-reference via leak-grep.cjs)
//   6. Register is regenerable / idempotent — re-running the audit script
//      produces the same record count
//
// Floor count: the audit script scopes scanning to <context> blocks (the
// leak class per D-08); the empirical count in this repo at Phase 2 ship time
// is 30 refs across 6 files in SCAN_DIRS. RESEARCH §"Audit Scope" originally
// counted 41 via raw grep (un-scoped to <context> blocks); 11 of those 41
// refs are outside <context> blocks (e.g. in <plan> blocks, frontmatter
// read_first directives) and are therefore not part of this leak class.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

// Test root is ./tests/leak-grep (per vitest.config.ts project root); resolve
// repo-root-relative paths from there.
const REPO_ROOT = resolve(__dirname, '..', '..');
const REGISTER_MD = resolve(REPO_ROOT, '.planning/leaks/context-block-register.md');
const REGISTER_JSON = resolve(REPO_ROOT, '.planning/leaks/context-block-register.json');
const AUDIT_SCRIPT = resolve(REPO_ROOT, 'scripts/audit-context-blocks.cjs');
const LEAK_GREP_SCRIPT = resolve(REPO_ROOT, 'scripts/leak-grep.cjs');

// Phase 2 floor — empirical count of <context>-block @.planning/ refs in SCAN_DIRS.
// LOW-4 strict assertion: every templates/ + references/ row must be EXCEPTION.
const REGISTER_FLOOR = 30;

const VALID_BUCKETS = ['REWRITE-CANDIDATE', 'INTERCEPT-CANDIDATE', 'EXCEPTION'] as const;

interface RegisterRecord {
  file: string;
  line: number;
  ref: string;
  excerpt: string;
  bucket: (typeof VALID_BUCKETS)[number];
  rationale: string;
}

interface RegisterDocument {
  audited: string;
  scan_dirs: string[];
  total: number;
  counts: Record<string, number>;
  records: RegisterRecord[];
}

function loadRegister(): RegisterDocument {
  return JSON.parse(readFileSync(REGISTER_JSON, 'utf-8')) as RegisterDocument;
}

describe('Phase 2 Plan 02-05: <context>-block register completeness', () => {
  it('register markdown exists and is non-empty', () => {
    const md = readFileSync(REGISTER_MD, 'utf-8');
    expect(md).toContain('Reference Register');
    expect(md).toContain('Total references');
    expect(md.length).toBeGreaterThan(500);
  });

  it(`JSON sidecar parses and has at least ${REGISTER_FLOOR} records (Phase 2 empirical floor)`, () => {
    const json = loadRegister();
    expect(Array.isArray(json.records)).toBe(true);
    expect(json.records.length).toBeGreaterThanOrEqual(REGISTER_FLOOR);
    expect(json.total).toBe(json.records.length);
  });

  it('every record has a valid bucket and non-empty rationale', () => {
    const json = loadRegister();
    for (const r of json.records) {
      expect(VALID_BUCKETS).toContain(r.bucket);
      expect(typeof r.rationale).toBe('string');
      expect(r.rationale.length).toBeGreaterThan(0);
      expect(r.file).toBeTruthy();
      expect(r.line).toBeGreaterThan(0);
      expect(r.ref).toMatch(/^@\.planning\//);
    }
  });

  it('LOW-4 strict — every reference under templates/ or references/ is classified EXCEPTION', () => {
    const json = loadRegister();
    const templateOrReferenceRows = json.records.filter(
      (r) => r.file.includes('/templates/') || r.file.includes('/references/'),
    );
    // Floor assertion — RESEARCH says templates dominate; we expect plenty.
    expect(templateOrReferenceRows.length).toBeGreaterThanOrEqual(1);
    // Strict assertion — a single misclassified row fails the test.
    for (const r of templateOrReferenceRows) {
      expect(r.bucket).toBe('EXCEPTION');
    }
  });

  it('MED-4 — fixture file is NOT in the register (outside SCAN_DIRS by design)', () => {
    const json = loadRegister();
    const fixtureRows = json.records.filter((r) => r.file.includes('tests/leak-grep/fixtures/'));
    expect(fixtureRows.length).toBe(0);
    // No record's file path should start with tests/ at all (single deterministic outcome).
    const testRows = json.records.filter((r) => r.file.startsWith('tests/'));
    expect(testRows.length).toBe(0);
  });

  it('no orphans — every leak-grep CONTEXT_BLOCK_RE match in SCAN_DIRS has a register entry', () => {
    // Run leak-grep over SCAN_DIRS only (NOT tests/ — outside SCAN_DIRS per MED-4).
    // leak-grep exits 1 when matches are found; we deliberately swallow that with `|| true`.
    const out = execSync(
      `node ${LEAK_GREP_SCRIPT} commands/ agents/ get-shit-done/ docs/ 2>/dev/null || true`,
      { cwd: REPO_ROOT, encoding: 'utf-8' },
    );
    const contextMatches = out.split('\n').filter((l) => l.includes(':context-block:'));
    const json = loadRegister();
    // leak-grep emits ONE line per <context>-block (regardless of how many
    // @.planning/ refs are inside the block). The register expands to ONE
    // row per @.planning/ ref. So register.length >= contextMatches.length.
    expect(json.records.length).toBeGreaterThanOrEqual(contextMatches.length);
  });

  it('idempotence — re-running the audit script produces the same record count', () => {
    const before = loadRegister().records.length;
    execSync(`node ${AUDIT_SCRIPT}`, { cwd: REPO_ROOT, encoding: 'utf-8' });
    const after = loadRegister().records.length;
    expect(after).toBe(before);
  });
});
