// Should match: fs-read-import + readFileSync + planningPaths scope (D-04 SDK_FS)
import { readFileSync } from 'node:fs';
import { planningPaths } from '../../sdk/src/query/helpers.js';

export function leak(projectDir: string): string {
  const paths = planningPaths(projectDir);
  return readFileSync(paths.state, 'utf-8');
}
