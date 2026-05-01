// C2 fixture (Phase 2 D-15): handler reads ~/.claude/, NOT inside the workspace
// planning tree. Stage-2 scope filter must suppress this match because no
// scope-trigger token (the bare planning-relative literal, the helper invocation,
// or paths.* dotted access) appears in the +/-20 line window around the fs call.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function readSkill(): string {
  return readFileSync(join(homedir(), '.claude', 'skills', 'foo.md'), 'utf-8');
}
