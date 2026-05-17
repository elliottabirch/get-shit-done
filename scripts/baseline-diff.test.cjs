#!/usr/bin/env node
/**
 * baseline-diff.test.cjs
 *
 * Unit tests for scripts/baseline-diff.cjs
 * Uses Node's built-in test runner (node:test).
 *
 * Run:
 *   node --test scripts/baseline-diff.test.cjs
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { extractFailingIds, evaluateGate, parseIdList } = require('./baseline-diff.cjs');

// Test 1: extractFailingIds returns Set of failed test IDs
test('extractFailingIds returns Set of failing test IDs from JSON file', () => {
  // Write a temporary fixture JSON with 2 failures + 1 pass
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-diff-test-'));
  const fixturePath = path.join(tmpDir, 'fixture.json');
  const fixture = {
    testResults: [
      {
        name: 'sdk/src/foo/foo.test.ts',
        status: 'failed',
        assertionResults: [
          { fullName: 'foo group > test passes', status: 'passed' },
          { fullName: 'foo group > test fails A', status: 'failed' },
        ],
      },
      {
        name: 'sdk/src/bar/bar.test.ts',
        status: 'failed',
        assertionResults: [
          { fullName: 'bar group > test fails B', status: 'failed' },
        ],
      },
    ],
  };
  fs.writeFileSync(fixturePath, JSON.stringify(fixture));

  try {
    const result = extractFailingIds(fixturePath);
    assert.ok(result instanceof Set, 'result should be a Set');
    assert.equal(result.size, 2, 'should have 2 failing IDs');
    assert.ok(
      result.has('sdk/src/foo/foo.test.ts::foo group > test fails A'),
      'should contain foo test ID',
    );
    assert.ok(
      result.has('sdk/src/bar/bar.test.ts::bar group > test fails B'),
      'should contain bar test ID',
    );
    assert.ok(
      !result.has('sdk/src/foo/foo.test.ts::foo group > test passes'),
      'should not contain passing test ID',
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// Test 2: evaluateGate returns uncategorized and pass=true when count <= 2
test('evaluateGate returns uncategorized failures and pass=true when count <= 2', () => {
  const rebaseFailures = new Set(['A', 'B', 'C', 'D']);
  const upstreamBaseline = new Set(['A']);
  const inheritedSkip = new Set(['B']);

  const result = evaluateGate({ rebaseFailures, upstreamBaseline, inheritedSkip });

  assert.deepEqual(result.uncategorized, ['C', 'D'], 'uncategorized should be C and D (sorted)');
  assert.equal(result.pass, true, 'pass should be true when uncategorized.length (2) <= 2');
});

// Test 3: evaluateGate returns pass=false when uncategorized.length === 3
test('evaluateGate returns pass=false when uncategorized.length === 3', () => {
  const rebaseFailures = new Set(['A', 'B', 'C', 'D', 'E']);
  const upstreamBaseline = new Set(['A']);
  const inheritedSkip = new Set(['B']);

  const result = evaluateGate({ rebaseFailures, upstreamBaseline, inheritedSkip });

  assert.equal(result.uncategorized.length, 3, 'should have 3 uncategorized failures');
  assert.equal(result.pass, false, 'pass should be false when uncategorized.length (3) > 2');
});

// Test 4: CLI invocation exits 0 on pass, 1 on fail, 2 on bad input
test('CLI invocation exits with correct codes', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-diff-cli-test-'));
  const scriptPath = path.resolve(__dirname, 'baseline-diff.cjs');

  try {
    // Create fixture files for a passing case (0 uncategorized)
    const rebranJson = path.join(tmpDir, 'rebase.json');
    const upstreamJson = path.join(tmpDir, 'upstream.json');
    const inheritedTxt = path.join(tmpDir, 'inherited.txt');

    const makeJson = (ids) => ({
      testResults: ids.map((id) => {
        const [file, fullName] = id.split('::');
        return {
          name: file,
          status: 'failed',
          assertionResults: [{ fullName, status: 'failed' }],
        };
      }),
    });

    // Passing case: all rebase failures in upstream baseline (0 uncategorized)
    fs.writeFileSync(rebranJson, JSON.stringify(makeJson(['f/a.ts::test A', 'f/b.ts::test B'])));
    fs.writeFileSync(upstreamJson, JSON.stringify(makeJson(['f/a.ts::test A', 'f/b.ts::test B'])));
    fs.writeFileSync(inheritedTxt, '');

    const passResult = spawnSync(process.execPath, [scriptPath, rebranJson, upstreamJson, inheritedTxt], { encoding: 'utf8' });
    assert.equal(passResult.status, 0, `CLI should exit 0 on pass; got ${passResult.status}. stderr: ${passResult.stderr}`);

    // Failing case: 3 uncategorized failures
    fs.writeFileSync(
      rebranJson,
      JSON.stringify(
        makeJson(['f/a.ts::test A', 'f/b.ts::test B', 'f/c.ts::test C', 'f/d.ts::test D']),
      ),
    );
    fs.writeFileSync(upstreamJson, JSON.stringify(makeJson(['f/a.ts::test A'])));
    fs.writeFileSync(inheritedTxt, '');

    const failResult = spawnSync(process.execPath, [scriptPath, rebranJson, upstreamJson, inheritedTxt], { encoding: 'utf8' });
    assert.equal(failResult.status, 1, `CLI should exit 1 on fail; got ${failResult.status}. stderr: ${failResult.stderr}`);

    // Error case: missing file
    const errorResult = spawnSync(process.execPath, [scriptPath, '/nonexistent.json', '/nonexistent2.json', '/nonexistent3.txt'], { encoding: 'utf8' });
    assert.equal(errorResult.status, 2, `CLI should exit 2 on bad input; got ${errorResult.status}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// Test 5: parseIdList parses newline-delimited ID file correctly
test('parseIdList parses newline-delimited ID file, ignoring blank lines', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-diff-parse-test-'));
  const idFile = path.join(tmpDir, 'ids.txt');

  // Write IDs with a blank line in the middle
  fs.writeFileSync(idFile, 'sdk/src/a/a.test.ts::test A\n\nsdk/src/b/b.test.ts::test B\n');

  try {
    const result = parseIdList(idFile);
    assert.ok(result instanceof Set, 'result should be a Set');
    assert.equal(result.size, 2, 'should have 2 IDs (blank line ignored)');
    assert.ok(result.has('sdk/src/a/a.test.ts::test A'), 'should contain ID A');
    assert.ok(result.has('sdk/src/b/b.test.ts::test B'), 'should contain ID B');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});
