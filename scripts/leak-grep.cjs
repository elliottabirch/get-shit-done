#!/usr/bin/env node
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
];

// <context>-block @.planning/ frontmatter scan (the new leak class from SYNTHESIS §1 #4)
// Heuristic: detect .planning/ inside a <context>...</context> block (any syntax, not
// just @-prefixed — per Pitfall 6: broader regex catches more patterns)
const CONTEXT_BLOCK_RE = /<context>([\s\S]*?)<\/context>/g;
const CONTEXT_PATH_RE = /\.planning\//;

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

  const lines = text.split(/\r?\n/);

  // Per-line scan for TOOL_PATTERNS + SHELL_PATTERNS
  lines.forEach((line, i) => {
    for (const { name, re } of [...TOOL_PATTERNS, ...SHELL_PATTERNS]) {
      if (re.test(line)) {
        matches.push({
          file: filePath,
          line: i + 1,
          category: name,
          text: line.trim(),
        });
      }
    }
  });

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

main(process.argv);
