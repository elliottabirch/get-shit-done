#!/usr/bin/env node
// leak-grep-allow file — this script describes the patterns it detects;
// the comments quoting `Read` / `Write` / `cp ... .planning/` etc. are
// by design and must not trigger self-referential matches.
/**
 * leak-grep.cjs
 *
 * Scans files for direct-I/O "leaks" that bypass the StorageAdapter seam.
 * Covers Rubric R5 patterns plus the <context>-block frontmatter scanner
 * (SYNTHESIS §1 #4 / CONTEXT.md D-14).
 *
 * Usage:
 *   node scripts/leak-grep.cjs <path> [<path>...]
 *
 * Exit codes:
 *   0 = no leaks found
 *   1 = one or more leaks found
 *   2 = no input paths provided
 *
 * Output (stdout): file:line:category:matched_text  (one line per match)
 * Output (stderr): summary (count of matches)
 *
 * Phase 4 (LEAKS-04) will wire this as a CI gate. Phase 1 ships the
 * engine + correctness tests only.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Pattern definitions (D-14 / RESEARCH.md Pattern 7 / SYNTHESIS R5)
// ---------------------------------------------------------------------------

// Tool patterns — Read/Write/Edit invocations against .planning/
// Match heuristic: tool keyword followed (within 200 chars) by a quote/backtick
// then .planning/. Catches markdown prose like: `Use the Read tool on \`.planning/STATE.md\``
const TOOL_PATTERNS = [
  { name: 'Read-tool',  re: /\bRead\b[^\n]{0,200}["'`]\.planning\// },
  { name: 'Write-tool', re: /\bWrite\b[^\n]{0,200}["'`]\.planning\// },
  { name: 'Edit-tool',  re: /\bEdit\b[^\n]{0,200}["'`]\.planning\// },
];

// Shell patterns — cp/mv/rm/>> against .planning/
const SHELL_PATTERNS = [
  { name: 'cp-shell',     re: /\bcp\b[^\n;]{0,200}\.planning\// },
  { name: 'mv-shell',     re: /\bmv\b[^\n;]{0,200}\.planning\// },
  { name: 'rm-rf-shell',  re: /\brm\s+-rf\b[^\n;]{0,200}\.planning\// },
  { name: 'append-shell', re: />>\s*\.planning\// },
  // Phase 4 Plan 01 additions (D-07/D-09): additional shell commands
  { name: 'mkdir-shell',    re: /\bmkdir\b[^\n;]{0,200}\.planning\// },
  { name: 'cat-shell',      re: /\bcat\b[^\n;]{0,200}\.planning\// },
  { name: 'find-shell',     re: /\bfind\b[^\n;]{0,200}\.planning\//, zone: 'workflow' },
  { name: 'ls-shell',       re: /\bls\b[^\n;]{0,200}\.planning\//,   zone: 'workflow' },
  { name: 'git-add-shell',  re: /\bgit\s+add\b[^\n;]{0,200}\.planning\// },
];

// Zone filter: patterns with zone='workflow' are only reported when the scanned file
// is under get-shit-done/workflows/, agents/, or commands/gsd/ — they are suppressed
// in templates/references where these may appear as documentation prose (T-04-02).
const WORKFLOW_ZONE_RE = /(?:get-shit-done\/workflows\/|agents\/|commands\/gsd\/)/;

// <context>-block @.planning/ frontmatter scan (the new leak class from SYNTHESIS §1 #4)
// Heuristic: detect .planning/ inside a <context>...</context> block (any syntax, not
// just @-prefixed — per Pitfall 6: broader regex catches more patterns)
const CONTEXT_BLOCK_RE = /<context>([\s\S]*?)<\/context>/g;
const CONTEXT_PATH_RE = /\.planning\//;

// SDK fs-read patterns (.ts only; .planning/-scoped via Stage-2 filter)
// Phase 2 D-04: covers the SDK migration's read surface; path-scoped so C2 files
// reading ~/.claude/, ~/gsd-workspaces/, etc. naturally pass.
const SDK_FS_READ_PATTERNS = [
  { name: 'fs-read-import', re: /\bimport\s+\{[^}]*\b(?:readFileSync|readdirSync|existsSync|statSync|readFile|readdir|stat|access)\b[^}]*\}\s+from\s+['"]node:fs(?:\/promises)?['"]/ },
  { name: 'fs-require',     re: /\brequire\s*\(\s*['"]node:fs(?:\/promises)?['"]\s*\)/ },
  { name: 'readFileSync',   re: /\breadFileSync\s*\(/ },
  { name: 'readdirSync',    re: /\breaddirSync\s*\(/ },
  { name: 'existsSync',     re: /\bexistsSync\s*\(/ },
  { name: 'statSync',       re: /\bstatSync\s*\(/ },
  { name: 'readFile-async', re: /\bawait\s+readFile\s*\(/ },
  { name: 'readdir-async',  re: /\bawait\s+readdir\s*\(/ },
  { name: 'stat-async',     re: /\bawait\s+(?:fsStat|stat)\s*\(/ },
];

// SDK fs-write patterns (.ts only; .planning/-scoped via Stage-2 filter)
// Phase 3: covers the SDK migration's write surface.
const SDK_FS_WRITE_PATTERNS = [
  { name: 'writeFile-async',    re: /\bawait\s+writeFile\s*\(/ },
  { name: 'writeFileSync',      re: /\bwriteFileSync\s*\(/ },
  { name: 'mkdirSync',          re: /\bmkdirSync\s*\(/ },
  { name: 'mkdir-async',        re: /\bawait\s+mkdir\s*\(/ },
  { name: 'unlinkSync',         re: /\bunlinkSync\s*\(/ },
  { name: 'unlink-async',       re: /\bawait\s+unlink\s*\(/ },
  { name: 'appendFileSync',     re: /\bappendFileSync\s*\(/ },
  { name: 'rename-async',       re: /\bawait\s+rename\s*\(/ },
  { name: 'rm-async',           re: /\bawait\s+rm\s*\(/ },
  { name: 'fs-write-import',    re: /\bimport\s+\{[^}]*\b(?:writeFile|mkdir|unlink|rename|rm|writeFileSync|mkdirSync|unlinkSync|appendFileSync)\b[^}]*\}\s+from\s+['"]node:fs(?:\/promises)?['"]/ },
];

// Stage-2 path-scope filter (must appear within ±20-line window for SDK_FS hit to count)
const PLANNING_SCOPE_RE = /(?:['"`]\.planning\/|planningPaths\s*\(|relPlanningPath\s*\(|planningRelativePath\s*\(|paths\.(state|roadmap|project|config|phases|requirements|planning)\b)/;

const SDK_FS_EXTS = /\.ts$/;

// ---------------------------------------------------------------------------
// File-level and line-level exclusion directives (D-07 / Phase 4 formalization)
// ---------------------------------------------------------------------------

// File-level: first 5 lines contain `// leak-grep-allow file` → skip entire file
const FILE_ALLOW_RE = /\/[/*]\s*leak-grep-allow\s+file\b/;

// Line-level: line contains `// leak-grep-ignore`, `/* leak-grep-ignore */`,
// or `<!-- leak-grep-ignore -->` (markdown HTML-comment form) → skip that line.
// Markdown support lets .md prose that describes the leak patterns (phase
// planning docs, success criteria, etc.) opt out without rendering a visible
// comment marker.
const LINE_IGNORE_RE = /(?:\/[/*]|<!--)\s*leak-grep-ignore\b/;

// ---------------------------------------------------------------------------
// Core scanner
// ---------------------------------------------------------------------------

/**
 * Scan a single file for leak patterns.
 * Returns an array of match objects: { file, line, category, text }
 */
function scanFile(filePath) {
  const matches = [];
  let text;

  try {
    text = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    process.stderr.write(`leak-grep: cannot read ${filePath}: ${err.message}\n`);
    return matches;
  }

  // File-level exclusion: check first 5 lines for `leak-grep-allow file`
  const headerLines = text.split(/\r?\n/).slice(0, 5);
  if (headerLines.some(l => FILE_ALLOW_RE.test(l))) {
    return matches;
  }

  const lines = text.split(/\r?\n/);

  // Per-line scan for TOOL_PATTERNS + SHELL_PATTERNS
  lines.forEach((line, i) => {
    // Line-level exclusion: skip lines with `leak-grep-ignore` directive
    if (LINE_IGNORE_RE.test(line)) return;
    for (const { name, re, zone } of [...TOOL_PATTERNS, ...SHELL_PATTERNS]) {
      if (!re.test(line)) continue;
      // Zone filter (T-04-02): patterns with zone='workflow' only fire in workflow/agent/command zones
      if (zone === 'workflow' && !WORKFLOW_ZONE_RE.test(filePath)) continue;
      // Exclusion: skip lines inside `gsd-sdk query` calls (A1: SDK mediates these)
      if (/\bgsd-sdk\s+query\b/.test(line)) continue;
      matches.push({
        file: filePath,
        line: i + 1,
        category: name,
        text: line.trim(),
      });
    }
  });

  // SDK_FS pass — .ts files only, with Stage-2 ±20-line .planning/ scope filter
  // Phase 2 D-04 (Plan 02-01 Task 2): SDK-side fs-read detection.
  // Phase 3: extended with SDK_FS_WRITE_PATTERNS for write-side coverage.
  if (SDK_FS_EXTS.test(filePath)) {
    const allSdkPatterns = [...SDK_FS_READ_PATTERNS, ...SDK_FS_WRITE_PATTERNS];
    lines.forEach((line, i) => {
      // Line-level exclusion: skip lines with `leak-grep-ignore` directive
      if (LINE_IGNORE_RE.test(line)) return;
      for (const { name, re } of allSdkPatterns) {
        if (!re.test(line)) continue;
        const lo = Math.max(0, i - 20);
        const hi = Math.min(lines.length, i + 21);
        const window = lines.slice(lo, hi).join('\n');
        if (!PLANNING_SCOPE_RE.test(window)) continue;
        matches.push({
          file: filePath,
          line: i + 1,
          category: name,
          text: line.trim(),
        });
      }
    });
  }

  // Whole-text scan for <context>-block leaks (multi-line)
  let m;
  // Reset lastIndex before use (important for global regexes)
  CONTEXT_BLOCK_RE.lastIndex = 0;
  const contextRe = /<context>([\s\S]*?)<\/context>/g;
  while ((m = contextRe.exec(text)) !== null) {
    const block = m[1];
    if (CONTEXT_PATH_RE.test(block)) {
      // Compute the line number of the <context> opening tag
      const lineNum = text.slice(0, m.index).split(/\r?\n/).length;
      // Find the specific line inside the block that contains .planning/
      const matchingLine = block.split(/\r?\n/).find(l => CONTEXT_PATH_RE.test(l));
      matches.push({
        file: filePath,
        line: lineNum,
        category: 'context-block',
        text: matchingLine?.trim() ?? '<context>-block .planning/ ref',
      });
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// File collection (walk directories, filter by extension)
// ---------------------------------------------------------------------------

const SCANNABLE_EXTS = /\.(md|ts|js|cjs|mjs)$/;

function collectFiles(input) {
  const files = [];

  let stat;
  try {
    stat = fs.statSync(input);
  } catch (err) {
    process.stderr.write(`leak-grep: cannot stat ${input}: ${err.message}\n`);
    return files;
  }

  if (stat.isDirectory()) {
    (function walk(dir) {
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (err) {
        process.stderr.write(`leak-grep: cannot read dir ${dir}: ${err.message}\n`);
        return;
      }
      for (const entry of entries) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(p);
        } else if (SCANNABLE_EXTS.test(entry.name)) {
          files.push(p);
        }
      }
    })(input);
  } else {
    files.push(input);
  }

  return files;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(argv) {
  const inputs = argv.slice(2);

  if (inputs.length === 0) {
    process.stderr.write('Usage: node scripts/leak-grep.cjs <path> [<path>...]\n');
    process.exit(2);
  }

  const files = [];
  for (const input of inputs) {
    files.push(...collectFiles(input));
  }

  let total = 0;
  for (const f of files) {
    const ms = scanFile(f);
    for (const match of ms) {
      process.stdout.write(`${match.file}:${match.line}:${match.category}:${match.text}\n`);
      total += 1;
    }
  }

  process.stderr.write(`leak-grep: ${total} match(es) across ${files.length} file(s)\n`);
  process.exit(total > 0 ? 1 : 0);
}

// Only invoke main() when this file is run directly as a CLI; when required
// (e.g. by Plan 5's audit-context-blocks.cjs or by tests), expose the regex
// constants + scanFile() without triggering a process.exit.
if (require.main === module) {
  main(process.argv);
}

module.exports = {
  TOOL_PATTERNS,
  SHELL_PATTERNS,
  SDK_FS_READ_PATTERNS,
  SDK_FS_WRITE_PATTERNS,
  PLANNING_SCOPE_RE,
  CONTEXT_BLOCK_RE,
  CONTEXT_PATH_RE,
  scanFile,
};
