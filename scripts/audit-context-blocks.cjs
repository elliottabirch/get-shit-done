#!/usr/bin/env node
/**
 * audit-context-blocks.cjs
 *
 * Phase 2 Plan 02-05 deliverable (READS-03 / OQ-04 partial).
 *
 * Scans repo for `<context>`-block frontmatter `@.planning/...` references,
 * auto-classifies each into the 3-bucket disposition
 * (REWRITE-CANDIDATE / INTERCEPT-CANDIDATE / EXCEPTION) and emits:
 *   - .planning/leaks/context-block-register.md  (human-readable register)
 *   - .planning/leaks/context-block-register.json (machine-readable for Phase 4)
 *
 * MED-4 lock: SCAN_DIRS is exactly commands/ + agents/ + get-shit-done/ + docs/.
 * Test fixtures under tests/ are intentionally OUTSIDE scope (single deterministic
 * outcome — fixture is not a runtime activation ref, never appears in register).
 *
 * LOW-4 strict: every reference under templates/ or references/ is classified
 * EXCEPTION (template/reference content; not a runtime activation ref).
 *
 * Reuses scripts/leak-grep.cjs's exported CONTEXT_BLOCK_RE / CONTEXT_PATH_RE
 * (Plan 02-01 added module.exports for this purpose).
 *
 * Usage:
 *   node scripts/audit-context-blocks.cjs           # generate register files
 *   node scripts/audit-context-blocks.cjs --check   # print count, exit 0
 *
 * Phase 4 LEAKS-02 reads the register and chooses uniform-vs-mixed
 * mitigation strategy.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Reuse leak-grep.cjs constants if available; else fall back to inline regexes.
let CONTEXT_BLOCK_RE_SRC;
let CONTEXT_PATH_RE_SRC;
try {
  const { CONTEXT_BLOCK_RE, CONTEXT_PATH_RE } = require('./leak-grep.cjs');
  CONTEXT_BLOCK_RE_SRC = CONTEXT_BLOCK_RE.source;
  CONTEXT_PATH_RE_SRC = CONTEXT_PATH_RE.source;
} catch {
  CONTEXT_BLOCK_RE_SRC = '<context>([\\s\\S]*?)<\\/context>';
  CONTEXT_PATH_RE_SRC = '\\.planning\\/';
}

// More specific: capture the full @.planning/<rest> ref token.
// Stops at whitespace, common punctuation, or markdown block delimiters.
const PLANNING_REF_RE_SRC = '@\\.planning\\/[^\\s)>"`\'<\\n]+';

// MED-4 fix: SCAN_DIRS is locked to these four — fixtures under tests/ are excluded.
const SCAN_DIRS = ['commands', 'agents', 'get-shit-done', 'docs'];
const SCANNABLE_EXTS = /\.(md|ts|js|cjs|mjs)$/;

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  // Sort for deterministic ordering (idempotence — Test 8 in Plan 5 Task 3).
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(p));
    } else if (SCANNABLE_EXTS.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

// D-07 3-bucket auto-classification.
// LOW-4 strict: templates/ and references/ paths ALWAYS EXCEPTION.
function classify(file, ref) {
  // LOW-4 first — strict template/reference rule comes before any other heuristic.
  if (file.includes('/templates/') || file.includes('/references/')) {
    return {
      bucket: 'EXCEPTION',
      rationale: 'template/reference content; not a runtime activation ref',
    };
  }
  const refPath = ref.replace(/^@\.planning\//, '');
  if (
    ['STATE.md', 'ROADMAP.md', 'PROJECT.md', 'REQUIREMENTS.md', 'DECISIONS.md'].includes(refPath)
  ) {
    return {
      bucket: 'REWRITE-CANDIDATE',
      rationale: 'canonical doc; skill body can call gsd-sdk query at runtime',
    };
  }
  if (refPath.startsWith('phases/')) {
    return {
      bucket: 'INTERCEPT-CANDIDATE',
      rationale: 'phase artifact; needs install-time hook to materialize before skill activates',
    };
  }
  if (refPath.includes('research/')) {
    return {
      bucket: 'EXCEPTION',
      rationale: 'research doc; read-once, content rarely changes — install-time materialization OK',
    };
  }
  return {
    bucket: 'INTERCEPT-CANDIDATE',
    rationale: 'default — Phase 4 LEAKS-02 may override per-row',
  };
}

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const records = [];
  // Use fresh stateful regex per-call (avoid lastIndex leakage across files).
  const blockRe = new RegExp(CONTEXT_BLOCK_RE_SRC, 'g');
  let m;
  while ((m = blockRe.exec(text)) !== null) {
    const block = m[1];
    const blockStart = m.index;
    const refRe = new RegExp(PLANNING_REF_RE_SRC, 'g');
    let r;
    while ((r = refRe.exec(block)) !== null) {
      // <context> tag length = 9; offset to inside the block start.
      const absoluteOffset = blockStart + '<context>'.length + r.index;
      const lineNum = text.slice(0, absoluteOffset).split(/\r?\n/).length;
      const blockLines = block.split(/\r?\n/);
      const excerpt = blockLines
        .slice(0, Math.min(blockLines.length, 6))
        .join(' / ')
        .slice(0, 120);
      records.push({
        file: filePath,
        line: lineNum,
        ref: r[0],
        excerpt,
        disposition: classify(filePath, r[0]),
      });
    }
  }
  return records;
}

function renderMarkdown(records) {
  const total = records.length;
  const counts = { 'REWRITE-CANDIDATE': 0, 'INTERCEPT-CANDIDATE': 0, EXCEPTION: 0 };
  for (const r of records) counts[r.disposition.bucket]++;

  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    '# `<context>`-block @.planning/ Reference Register',
    '',
    `**Last audited:** ${today}`,
    `**Total references:** ${total}`,
    `**By disposition:** REWRITE-CANDIDATE: ${counts['REWRITE-CANDIDATE']} | INTERCEPT-CANDIDATE: ${counts['INTERCEPT-CANDIDATE']} | EXCEPTION: ${counts.EXCEPTION}`,
    '',
    '> Phase 2 deliverable per READS-03 / D-05/D-06/D-07/D-08.',
    '> Phase 4 LEAKS-02 chooses uniform-vs-mixed mitigation strategy.',
    '> Auto-generated by `scripts/audit-context-blocks.cjs` — manual edits are preserved on regeneration only if the script is re-run with identical input. Hand-classified overrides should be tracked in Phase 4 LEAKS-02 source.',
    '',
    '## Bucket Definitions',
    '',
    '- **REWRITE-CANDIDATE:** Skill/workflow body can invoke `gsd-sdk query` to load the doc at runtime; the frontmatter `@`-ref is removable.',
    '- **INTERCEPT-CANDIDATE:** Doc must be present at frontmatter-load time; needs install-time hook to materialize from adapter before skill activates.',
    '- **EXCEPTION:** Doc fundamentally needs to load at activation and cannot be intercepted (e.g. it is a template / reference / research doc); document why.',
    '',
    '## Scan Scope (MED-4 lock)',
    '',
    `- SCAN_DIRS: \`${SCAN_DIRS.join('/, ')}/\``,
    '- Test fixtures under `tests/` are OUT of scope by design (fixture is not a runtime activation ref).',
    '',
    '## Register',
    '',
    '| # | File:Line | Reference path | Bucket | Rationale | Excerpt |',
    '|---|-----------|----------------|--------|-----------|---------|',
    ...records.map(
      (r, i) =>
        `| ${i + 1} | \`${r.file}:${r.line}\` | \`${r.ref}\` | ${r.disposition.bucket} | ${r.disposition.rationale} | ${r.excerpt
          .replace(/\|/g, '\\|')
          .replace(/`/g, "'")} |`,
    ),
    '',
  ];
  return lines.join('\n');
}

function renderJson(records) {
  const today = new Date().toISOString().slice(0, 10);
  const counts = { 'REWRITE-CANDIDATE': 0, 'INTERCEPT-CANDIDATE': 0, EXCEPTION: 0 };
  for (const r of records) counts[r.disposition.bucket]++;
  return (
    JSON.stringify(
      {
        audited: today,
        scan_dirs: SCAN_DIRS,
        total: records.length,
        counts,
        records: records.map((r) => ({
          file: r.file,
          line: r.line,
          ref: r.ref,
          excerpt: r.excerpt,
          bucket: r.disposition.bucket,
          rationale: r.disposition.rationale,
        })),
      },
      null,
      2,
    ) + '\n'
  );
}

function main(argv) {
  const checkOnly = argv.includes('--check');
  const allFiles = SCAN_DIRS.flatMap((d) => walk(d));
  const records = allFiles.flatMap(scanFile);

  if (checkOnly) {
    process.stdout.write(
      `audit-context-blocks: ${records.length} ref(s) across ${allFiles.length} file(s) in ${SCAN_DIRS.join(', ')}\n`,
    );
    process.exit(0);
  }

  fs.mkdirSync('.planning/leaks', { recursive: true });
  fs.writeFileSync('.planning/leaks/context-block-register.md', renderMarkdown(records));
  fs.writeFileSync('.planning/leaks/context-block-register.json', renderJson(records));
  process.stdout.write(
    `audit-context-blocks: registered ${records.length} ref(s) across ${allFiles.length} scanned file(s)\n`,
  );
  process.exit(0);
}

if (require.main === module) {
  main(process.argv);
}

module.exports = { scanFile, classify, renderMarkdown, renderJson, SCAN_DIRS };
