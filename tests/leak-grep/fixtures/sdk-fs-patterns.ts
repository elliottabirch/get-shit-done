// Exercises every SDK_FS_READ_PATTERNS category. All callsites are inside .planning/ scope
// (planningPaths or '.planning/' literal), so every match must fire.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { readFile, readdir, stat as fsStat } from 'node:fs/promises';
import { planningPaths } from '../../sdk/src/query/helpers.js';

export async function exerciseAll(projectDir: string): Promise<void> {
  const paths = planningPaths(projectDir);
  readFileSync(paths.state, 'utf-8');
  readdirSync(paths.phases);
  existsSync(paths.config);
  statSync(paths.roadmap);
  await readFile(paths.requirements, 'utf-8');
  await readdir(paths.phases);
  await fsStat(paths.state);
  const fsModule = require('node:fs');
  void fsModule;
}
