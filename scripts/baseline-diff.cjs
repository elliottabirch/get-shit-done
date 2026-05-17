#!/usr/bin/env node
/**
 * baseline-diff.cjs
 *
 * Set-difference gate for vitest JSON outputs (D-10 formula).
 *
 * Given:
 *   - A vitest JSON report for the rebase branch
 *   - A vitest JSON report for the upstream baseline (ae63cbe5)
 *   - A newline-delimited file of inherited-skip test IDs
 *
 * Computes:
 *   uncategorized = rebase_failures - upstream_baseline_failures - inherited_skip_set
 *
 * Exits:
 *   0 (EXIT_PASS)  if uncategorized.length <= 2
 *   1 (EXIT_FAIL)  if uncategorized.length >= 3
 *   2 (EXIT_ERROR) on bad input / I/O failure
 *
 * Prints uncategorized IDs to stdout, then a summary line.
 *
 * Usage:
 *   node scripts/baseline-diff.cjs <rebase.json> <upstream.json> <inherited-ids.txt>
 *
 * For Phase 1 Plan 01-01 REBASE-02 gate (D-06, D-07, D-08, D-09, D-10).
 * Reusable for future rebase milestones.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EXIT_PASS = 0;
const EXIT_FAIL = 1;
const EXIT_ERROR = 2;

function fail(message, err) {
  process.stderr.write(`baseline-diff: ${message}\n`);
  if (err && err.stack) process.stderr.write(`${err.stack}\n`);
  process.exit(EXIT_ERROR);
}

/**
 * Extract failing test IDs from a vitest JSON report.
 *
 * Stable ID format: "<file>::<fullName>"
 * where fullName is the describe path + " > " + test name.
 *
 * @param {string} jsonPath - Path to the vitest JSON report
 * @returns {Set<string>} Set of failing test IDs
 */
function extractFailingIds(jsonPath) {
  let text;
  try {
    text = fs.readFileSync(jsonPath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read JSON file: ${jsonPath}: ${err.message}`);
  }

  let r;
  try {
    r = JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse JSON file: ${jsonPath}: ${err.message}`);
  }

  const ids = new Set();
  for (const f of r.testResults || []) {
    for (const a of f.assertionResults || []) {
      if (a.status === 'failed') {
        ids.add(f.name + '::' + a.fullName);
      }
    }
  }
  return ids;
}

/**
 * Parse a newline-delimited file of test IDs.
 * Ignores blank lines and trims whitespace.
 *
 * @param {string} filePath - Path to the ID list file
 * @returns {Set<string>} Set of test IDs
 */
function parseIdList(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read ID list file: ${filePath}: ${err.message}`);
  }

  const ids = new Set(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  );
  return ids;
}

/**
 * Evaluate the REBASE-02 set-difference gate (D-10 formula).
 *
 * uncategorized = rebaseFailures - upstreamBaseline - inheritedSkip
 * pass = uncategorized.length <= 2
 *
 * @param {object} params
 * @param {Set<string>} params.rebaseFailures - Failing IDs on the rebase branch
 * @param {Set<string>} params.upstreamBaseline - Failing IDs on upstream baseline
 * @param {Set<string>} params.inheritedSkip - Known allowed-skip IDs
 * @returns {{ uncategorized: string[], pass: boolean }}
 */
function evaluateGate({ rebaseFailures, upstreamBaseline, inheritedSkip }) {
  const uncategorized = [...rebaseFailures]
    .filter((x) => !upstreamBaseline.has(x) && !inheritedSkip.has(x))
    .sort();
  return { uncategorized, pass: uncategorized.length <= 2 };
}

function main() {
  process.on('uncaughtException', (err) => fail('uncaught exception', err));
  process.on('unhandledRejection', (err) => fail('unhandled rejection', err));

  const [, , rebranJsonPath, upstreamJsonPath, inheritedTxtPath] = process.argv;

  if (!rebranJsonPath || !upstreamJsonPath || !inheritedTxtPath) {
    process.stderr.write(
      'baseline-diff: usage: node scripts/baseline-diff.cjs <rebase.json> <upstream.json> <inherited-ids.txt>\n',
    );
    process.exit(EXIT_ERROR);
  }

  let rebaseFailures, upstreamBaseline, inheritedSkip;

  try {
    rebaseFailures = extractFailingIds(rebranJsonPath);
  } catch (err) {
    return fail(`failed to read rebase JSON: ${err.message}`);
  }

  try {
    upstreamBaseline = extractFailingIds(upstreamJsonPath);
  } catch (err) {
    return fail(`failed to read upstream JSON: ${err.message}`);
  }

  try {
    inheritedSkip = parseIdList(inheritedTxtPath);
  } catch (err) {
    return fail(`failed to read inherited-skip list: ${err.message}`);
  }

  const { uncategorized, pass } = evaluateGate({ rebaseFailures, upstreamBaseline, inheritedSkip });

  for (const id of uncategorized) {
    process.stdout.write(`${id}\n`);
  }
  process.stdout.write(`summary: ${uncategorized.length} uncategorized failure(s)\n`);

  process.exit(pass ? EXIT_PASS : EXIT_FAIL);
}

if (require.main === module) {
  main();
}

module.exports = { extractFailingIds, parseIdList, evaluateGate, EXIT_PASS, EXIT_FAIL, EXIT_ERROR };
