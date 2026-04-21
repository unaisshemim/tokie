import { sendMessage, type SkillsShHit } from "./messages";

const DEFAULT_LIMIT = 80;

export async function searchSkillsDirectory(
  query: string,
  limit = DEFAULT_LIMIT
): Promise<SkillsShHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await sendMessage({
    type: "SEARCH_SKILLS_SH",
    query: q,
    limit,
  });
  if (!res.ok) throw new Error(res.error);
  return res.hits;
}

export async function getSkillBodyForHit(
  hit: SkillsShHit,
  force = false
): Promise<string> {
  const res = await sendMessage({
    type: "FETCH_SKILL_BODY",
    source: hit.source,
    skillId: hit.skillId,
    force,
  });
  if (!res.ok) throw new Error(res.error);
  return res.body;
}
