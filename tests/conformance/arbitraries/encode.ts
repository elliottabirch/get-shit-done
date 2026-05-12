/**
 * Shared encode helper: converts a noun value into a markdown body
 * suitable for adapter.putRecord(path, body). Each noun module may
 * override/extend; this file provides the default shape.
 *
 * For most nouns, the encoding is a YAML frontmatter block + a
 * structured body section. MarkdownAdapter round-trips byte-for-byte
 * (normalize = identity); BeadsAdapter round-trips modulo frontmatter
 * re-serialization (normalize composes parseFrontmatter/formatFrontmatter).
 */

/** Encode a generic frontmatter + body to a markdown string. */
export function encodeFrontmatterDoc(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  const yamlLines: string[] = [];
  for (const [key, value] of Object.entries(frontmatter)) {
    yamlLines.push(`${key}: ${JSON.stringify(value)}`);
  }
  return `---\n${yamlLines.join('\n')}\n---\n${body}\n`;
}
