/** Result row from https://skills.sh/api/search (same index as the website). */
export type SkillsShHit = {
  id: string;
  skillId: string;
  name: string;
  installs: number;
  source: string;
};

export type MessageRequest =
  | { type: "TOGGLE_SKILLS_MODAL" }
  | { type: "SEARCH_SKILLS_SH"; query: string; limit?: number }
  | {
      type: "FETCH_SKILL_BODY";
      source: string;
      skillId: string;
      force?: boolean;
    };

export type MessageResponse<T extends MessageRequest["type"]> =
  T extends "SEARCH_SKILLS_SH"
    ? { ok: true; hits: SkillsShHit[] } | { ok: false; error: string }
    : T extends "FETCH_SKILL_BODY"
    ? { ok: true; body: string } | { ok: false; error: string }
    : { ok: true };

export async function sendMessage<T extends MessageRequest>(
  req: T
): Promise<MessageResponse<T["type"]>> {
  return (await browser.runtime.sendMessage(req)) as MessageResponse<
    T["type"]
  >;
}
