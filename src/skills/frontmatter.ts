export type SkillFrontmatter = {
  name?: string;
  description?: string;
  [key: string]: string | undefined;
};

export type ParsedSkill = {
  meta: SkillFrontmatter;
  body: string;
};

/**
 * Minimal YAML frontmatter extractor. Supports flat `key: value` pairs
 * between a leading `---` fence and a closing `---` fence. Values may be
 * single- or double-quoted. Anything beyond the closing fence is returned
 * as the `body` string, trimmed of its leading blank line.
 */
export function parseFrontmatter(raw: string): ParsedSkill {
  const normalized = raw.replace(/\r\n/g, "\n");
  const fenceMatch = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!fenceMatch) {
    return { meta: {}, body: normalized.trim() };
  }

  const meta: SkillFrontmatter = {};
  for (const line of fenceMatch[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) meta[key] = value;
  }

  const body = normalized.slice(fenceMatch[0].length).replace(/^\n+/, "");
  return { meta, body };
}

export function stripFrontmatter(raw: string): string {
  return parseFrontmatter(raw).body;
}
