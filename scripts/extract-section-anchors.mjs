#!/usr/bin/env node
// leak-grep-allow file — this script scans for updateSection/getSection call sites;
// the pattern descriptions here are intentional and must not trigger self-referential matches.
// scripts/extract-section-anchors.mjs
// D-08 (Phase 7): extract section-anchor call sites from fork SDK +
// workflows + MarkdownAdapter; emit manifest-ready JSON + dynamic-
// anchor gate file. Runs pre-vitest via `prebuild:conformance`.
//
// Exit codes:
//   0  — grep OK; all anchors either string-literal OR allowlisted in manifest
//   1  — dynamic-anchor caller found AND not allowlisted; CI must fail
//   2  — internal error (ripgrep/grep missing + fallback failed, or write failed)

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'tests/conformance/.generated');
const ANCHORS_OUT = join(OUT_DIR, 'anchors.json');
const DYNAMIC_OUT = join(OUT_DIR, 'dynamic-anchors.warn');

mkdirSync(OUT_DIR, { recursive: true });

// Auto-detect rg; fall back to grep -rE for CI runners without ripgrep.
const hasRg = spawnSync('rg', ['--version'], { encoding: 'utf-8' }).status === 0;

function runGrep(pattern, paths, opts = {}) {
  const { pcre2 = false } = opts;
  if (hasRg) {
    const args = ['-n'];
    if (pcre2) args.push('--pcre2');
    args.push(pattern, ...paths);
    const r = spawnSync('rg', args, { encoding: 'utf-8' });
    if (r.status !== 0 && r.status !== 1) {
      // rg: 0 = matches, 1 = no matches, other = error
      throw new Error(`rg failed: ${r.stderr}`);
    }
    return r.stdout ?? '';
  }
  // grep fallback (POSIX ERE). --pcre2 features like lookahead don't
  // work here; for the dynamic-anchor pass we widen the regex (accept
  // false positives; the manifest review stage catches them).
  const args = ['-rEn', pattern, ...paths];
  const r = spawnSync('grep', args, { encoding: 'utf-8' });
  // grep: 0 = matches, 1 = no matches, 2 = error
  if (r.status !== 0 && r.status !== 1) {
    throw new Error(`grep failed: ${r.stderr}`);
  }
  return r.stdout ?? '';
}

// Scope paths: fork SDK source + adapter code. Skip tests (they're
// allowed to use dynamic anchors for parameterization).
const SCAN_PATHS = ['sdk/src', 'adapters'].filter((p) => existsSync(join(ROOT, p)));

// --- Pass 1: public adapter API call sites with string-literal anchors ---
// Pattern: adapter.updateSection(path, "Anchor", ...) — second arg is
// a string literal (single, double, or backtick). We capture the
// method name and the anchor content.
const literalPass = runGrep(
  hasRg
    ? `\\.(updateSection|getSection)\\(\\s*[^,]+,\\s*['"\\x60]([^'"\\x60]+)['"\\x60]`
    : `\\.(updateSection|getSection)\\([^,]+,[[:space:]]*['"]`,
  SCAN_PATHS,
  { pcre2: true },
);

// --- Pass 2: MarkdownAdapter internal heading literals (Tier 1 source) ---
// These are the `'## Decisions Made'`, `'## Blockers'`, etc. literals
// that recordState* helpers match/create inside MarkdownAdapter.
const internalPass = runGrep(
  hasRg
    ? `['"\\x60](#{2,4} [A-Z][^'"\\x60]+)['"\\x60]`
    : `['"](##+ [A-Z][^'"]+)['"]`,
  [join(ROOT, 'adapters/markdown/index.ts')],
  { pcre2: true },
);

// --- Pass 3: Dynamic-anchor gate — second arg is NOT a string literal ---
// Matches adapter.updateSection(path, <non-literal>, ...). Uses a
// negative lookahead on rg; on grep fallback we approximate with a
// pattern that excludes obvious literals (imprecise but fails safe).
const dynamicPass = hasRg
  ? runGrep(
      `\\.(updateSection|getSection)\\(\\s*[^,]+,\\s*(?!['"\\x60])`,
      SCAN_PATHS,
      { pcre2: true },
    )
  : // grep fallback: find all updateSection/getSection calls, subtract
    // string-literal hits textually.
    (() => {
      const all = runGrep(`\\.(updateSection|getSection)\\(`, SCAN_PATHS);
      const lits = new Set(literalPass.split('\n'));
      return all.split('\n').filter((l) => l && !lits.has(l)).join('\n');
    })();

// --- Parse literal pass into manifest-ready tuples ---
const tuples = [];
for (const line of literalPass.split('\n').filter(Boolean)) {
  // rg output shape: path:line:match
  const m = line.match(/^([^:]+):(\d+):(.*)$/);
  if (!m) continue;
  const [, file, lineno, body] = m;
  // Best-effort anchor extraction from the matched line.
  const anchorMatch = body.match(/['"`]([^'"`]+)['"`]/g);
  const anchor = anchorMatch?.[1]?.replace(/^['"`]|['"`]$/g, '') ?? null;
  const method = body.includes('updateSection') ? 'updateSection' : 'getSection';
  tuples.push({ kind: 'section-tuple', file, line: Number(lineno), method, anchor });
}

const internalLiterals = [];
for (const line of internalPass.split('\n').filter(Boolean)) {
  const m = line.match(/^([^:]+):(\d+):(.*)$/);
  if (!m) continue;
  const [, file, lineno, body] = m;
  const anchorMatch = body.match(/['"`](#{2,4} [^'"`]+)['"`]/);
  if (!anchorMatch) continue;
  internalLiterals.push({ file, line: Number(lineno), anchor: anchorMatch[1] });
}

writeFileSync(
  ANCHORS_OUT,
  JSON.stringify({ literals: tuples, internal: internalLiterals }, null, 2) + '\n',
);
writeFileSync(DYNAMIC_OUT, dynamicPass.trim() ? dynamicPass : '');

// --- Gate: fail on any dynamic anchor unless allowlisted in manifest ---
if (dynamicPass.trim()) {
  // TODO (future): load CONFORMANCE_MANIFEST and filter out allowlisted
  // callers. For Phase 7 ship, zero dynamic anchors expected (A4);
  // any find is a hard failure until explicitly registered.
  console.error('dynamic-anchor callers found (must be string literal OR');
  console.error('registered in CONFORMANCE_MANIFEST as kind:"section-tuple"');
  console.error('with name prefix "dynamic:"):');
  console.error(dynamicPass);
  process.exit(1);
}

// Quiet success — called from `prebuild:conformance`; noisy output
// clutters CI logs.
console.log(
  `extract-section-anchors: ${tuples.length} literal(s), ` +
  `${internalLiterals.length} internal literal(s), 0 dynamic`,
);
