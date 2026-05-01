// Should NOT match: no fs imports, uses adapter only.
import type { StorageAdapter } from '../../adapters/types.js';

export async function clean(adapter: StorageAdapter): Promise<string> {
  return (await adapter.getRecord('STATE.md')) ?? '';
}
