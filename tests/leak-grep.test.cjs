'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'leak-grep.cjs');
const FIXTURES = path.resolve(__dirname, 'leak-grep', 'fixtures');

function runLeakGrep(fixture) {
  try {
    const stdout = execFileSync('node', [SCRIPT, path.join(FIXTURES, fixture)], { encoding: 'utf-8' });
    return { exitCode: 0, stdout };
  } catch (err) {
    return { exitCode: err.status, stdout: err.stdout?.toString() ?? '' };
  }
}

test('clean-skill.md produces zero leaks', () => {
  const { exitCode, stdout } = runLeakGrep('clean-skill.md');
  assert.equal(exitCode, 0, `expected 0, got ${exitCode}; stdout: ${stdout}`);
  assert.equal(stdout.trim(), '');
});

test('leaky-skill-context.md detects <context>-block leak', () => {
  const { exitCode, stdout } = runLeakGrep('leaky-skill-context.md');
  assert.equal(exitCode, 1);
  assert.match(stdout, /context-block/);
  assert.match(stdout, /\.planning\//);
});

test('leaky-workflow-tools.md detects Read/Write/Edit leaks', () => {
  const { exitCode, stdout } = runLeakGrep('leaky-workflow-tools.md');
  assert.equal(exitCode, 1);
  assert.match(stdout, /Read-tool/);
  assert.match(stdout, /Write-tool/);
  assert.match(stdout, /Edit-tool/);
});

test('leaky-workflow-shell.md detects cp/mv/rm/>> leaks', () => {
  const { exitCode, stdout } = runLeakGrep('leaky-workflow-shell.md');
  assert.equal(exitCode, 1);
  assert.match(stdout, /cp-shell/);
  assert.match(stdout, /mv-shell/);
  assert.match(stdout, /rm-rf-shell/);
  assert.match(stdout, /append-shell/);
});

test('machine-readable output format (file:line:category:text)', () => {
  // Use the shell fixture whose categories (cp-shell, mv-shell, etc.) are all lowercase,
  // matching the [a-z-]+ regex which validates the format without uppercase ambiguity.
  const { stdout } = runLeakGrep('leaky-workflow-shell.md');
  const firstLine = stdout.split('\n').filter(Boolean)[0];
  assert.match(firstLine, /^[^:]+:\d+:[a-z-]+:/);
});

// ---------------------------------------------------------------------------
// Phase 2 Plan 02-01 Task 2 — SDK_FS_READ_PATTERNS coverage
// ---------------------------------------------------------------------------

test('leaky-sdk-handler.ts detects readFileSync + planningPaths scope', () => {
  const { exitCode, stdout } = runLeakGrep('leaky-sdk-handler.ts');
  assert.equal(exitCode, 1);
  assert.match(stdout, /readFileSync/);
  assert.match(stdout, /fs-read-import/);
});

test('clean-sdk-handler.ts produces zero leaks', () => {
  const { exitCode, stdout } = runLeakGrep('clean-sdk-handler.ts');
  assert.equal(exitCode, 0, `expected 0, got ${exitCode}; stdout: ${stdout}`);
  assert.equal(stdout.trim(), '');
});

test('c2-handler.ts (~/.claude/ reads) does not trigger SDK_FS pattern', () => {
  const { exitCode, stdout } = runLeakGrep('c2-handler.ts');
  assert.equal(exitCode, 0, `expected 0, got ${exitCode}; stdout: ${stdout}`);
  assert.equal(stdout.trim(), '');
});

test('sdk-fs-patterns.ts exercises every SDK_FS category', () => {
  const { exitCode, stdout } = runLeakGrep('sdk-fs-patterns.ts');
  assert.equal(exitCode, 1);
  // Every listed category should appear at least once
  for (const cat of [
    'readFileSync', 'readdirSync', 'existsSync', 'statSync',
    'readFile-async', 'readdir-async', 'stat-async',
    'fs-read-import', 'fs-require',
  ]) {
    assert.match(stdout, new RegExp(cat), `category ${cat} missing`);
  }
});

test('md-ignore-html-comment.md: <!-- leak-grep-ignore --> suppresses markdown prose matches', () => {
  const { exitCode, stdout } = runLeakGrep('md-ignore-html-comment.md');
  assert.equal(exitCode, 0, `expected 0, got ${exitCode}; stdout: ${stdout}`);
  assert.equal(stdout.trim(), '');
});
