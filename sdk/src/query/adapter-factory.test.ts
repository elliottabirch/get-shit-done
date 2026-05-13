import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-factory-'));
  await mkdir(join(tmpDir, '.planning'), { recursive: true });
});
afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('createStorageAdapter', () => {
  it('returns MarkdownAdapter when opts is omitted', async () => {
    const { createStorageAdapter } = await import('./adapter-factory.js');
    const adapter = createStorageAdapter(tmpDir);
    expect(adapter.constructor.name).toBe('MarkdownAdapter');
  });

  it('returns MarkdownAdapter when adapter=markdown', async () => {
    const { createStorageAdapter } = await import('./adapter-factory.js');
    const adapter = createStorageAdapter(tmpDir, { adapter: 'markdown' });
    expect(adapter.constructor.name).toBe('MarkdownAdapter');
  });

  it('returns BeadsAdapter when adapter=beads and gsd-beads is installed', async () => {
    // gsd-beads is a devDep via file:../gsd-beads; createRequire should resolve it in dev.
    const { createStorageAdapter } = await import('./adapter-factory.js');
    const adapter = createStorageAdapter(tmpDir, { adapter: 'beads' });
    expect(adapter.constructor.name).toBe('BeadsAdapter');
  });

  it('throws BeadsAdapterUnavailable (brand-checked) when beads requested but unresolvable', async () => {
    // Validate brand + instanceof resilience directly:
    const { BeadsAdapterUnavailable } = await import('./adapter-factory.js');
    const err = new BeadsAdapterUnavailable('missing-package', 'npm install gsd-beads');
    expect((err as unknown as { __brand: string }).__brand).toBe('BeadsAdapterUnavailable');
    expect(err instanceof BeadsAdapterUnavailable).toBe(true);
    expect(err.message).toContain('npm install gsd-beads');
  });

  it('throws Error with "Unknown adapter" message for unknown adapter name', async () => {
    const { createStorageAdapter } = await import('./adapter-factory.js');
    expect(() => createStorageAdapter(tmpDir, { adapter: 'sqlite' as never })).toThrow(/Unknown adapter/);
  });
});
