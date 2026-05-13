#!/usr/bin/env node
/**
 * Build-time alias generator — writes BOTH the committed TS artifact
 * (sdk/src/query/command-aliases.generated.ts) and the CJS mirror
 * (get-shit-done/bin/lib/command-aliases.generated.cjs) in a single run.
 *
 * Usage: cd sdk && npx tsx scripts/gen-command-aliases.ts
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { COMMAND_DEFINITIONS_BY_FAMILY } from '../src/query/command-definition.js';

function toSubcommand(canonical: string, family: 'state' | 'verify' | 'init' | 'phase' | 'phases' | 'validate' | 'roadmap'): string {
  const prefix = `${family}.`;
  return canonical.startsWith(prefix) ? canonical.slice(prefix.length) : canonical;
}

interface AliasEntry {
  canonical: string;
  aliases: string[];
  subcommand: string;
  mutation: boolean;
}

interface FamilySpec {
  family: 'state' | 'verify' | 'init' | 'phase' | 'phases' | 'validate' | 'roadmap';
  constName: string;
  subcommandConst: string;
  entries: AliasEntry[];
}

function escapeQuote(s: string): string {
  return s.replace(/'/g, "\\'");
}

function formatEntry(entry: AliasEntry): string {
  const aliases =
    entry.aliases.length === 0
      ? '[]'
      : `[${entry.aliases.map((a) => `'${escapeQuote(a)}'`).join(', ')}]`;
  return `  { canonical: '${escapeQuote(entry.canonical)}', aliases: ${aliases}, subcommand: '${escapeQuote(entry.subcommand)}', mutation: ${entry.mutation} },`;
}

function formatTs(families: FamilySpec[]): string {
  const lines: string[] = [];

  lines.push(
    `/**`,
    ` * GENERATED FILE — command alias expansion for state.*, verify.*, init.*, phase.*, phases.*, validate.*, roadmap.*.`,
    ` *`,
    ` * Regenerate: cd sdk && npx tsx scripts/gen-command-aliases.ts`,
    ` */`,
    ``,
    `export interface FamilyCommandAlias {`,
    `  canonical: string;`,
    `  aliases: string[];`,
    `  subcommand: string;`,
    `  mutation: boolean;`,
    `}`,
    ``,
  );

  for (const spec of families) {
    lines.push(
      `export const ${spec.constName}: readonly FamilyCommandAlias[] = [`,
      ...spec.entries.map(formatEntry),
      `] as const;`,
      ``,
      `export const ${spec.subcommandConst} = new Set<string>(`,
      `  ${spec.constName}.map((entry) => entry.subcommand),`,
      `);`,
      ``,
    );
  }

  return lines.join('\n');
}

function formatCjs(families: FamilySpec[]): string {
  const lines: string[] = [];

  lines.push(
    `'use strict';`,
    ``,
    `/**`,
    ` * GENERATED FILE — state.*, verify.*, init.*, phase.*, phases.*, validate.*, roadmap.* alias/subcommand metadata for CJS routing.`,
    ` *`,
    ` * Regenerate: cd sdk && npx tsx scripts/gen-command-aliases.ts`,
    ` */`,
    ``,
  );

  for (const spec of families) {
    lines.push(
      `const ${spec.constName} = [`,
      ...spec.entries.map(formatEntry),
      `];`,
      `const ${spec.subcommandConst} = ${spec.constName}.map((entry) => entry.subcommand);`,
      ``,
    );
  }

  const allConstNames = families.map((f) => f.constName).join(', ');
  const allSubcommandConsts = families.map((f) => f.subcommandConst).join(', ');
  lines.push(
    `module.exports = {`,
    `  ${allConstNames},`,
    `  ${allSubcommandConsts},`,
    `};`,
  );

  return lines.join('\n');
}

async function main(): Promise<void> {
  const familyNames: Array<'state' | 'verify' | 'init' | 'phase' | 'phases' | 'validate' | 'roadmap'> = [
    'state', 'verify', 'init', 'phase', 'phases', 'validate', 'roadmap',
  ];

  const families: FamilySpec[] = familyNames.map((family) => {
    const upperFamily = family.toUpperCase();
    return {
      family,
      constName: `${upperFamily}_COMMAND_ALIASES`,
      subcommandConst: `${upperFamily}_SUBCOMMANDS`,
      entries: COMMAND_DEFINITIONS_BY_FAMILY[family].map((entry) => ({
        canonical: entry.canonical,
        aliases: entry.aliases,
        subcommand: toSubcommand(entry.canonical, family),
        mutation: entry.mutation,
      })),
    };
  });

  const tsOutPath = fileURLToPath(new URL('../src/query/command-aliases.generated.ts', import.meta.url));
  const cjsOutPath = fileURLToPath(new URL('../../get-shit-done/bin/lib/command-aliases.generated.cjs', import.meta.url));

  await writeFile(tsOutPath, formatTs(families), 'utf-8');
  await writeFile(cjsOutPath, formatCjs(families), 'utf-8');

  console.log(`Wrote ${tsOutPath}`);
  console.log(`Wrote ${cjsOutPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
