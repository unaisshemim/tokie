import type { MessageRequest, SkillsShHit } from "@/skills/messages";

const RAW_HEADERS: HeadersInit = {
  "User-Agent":
    "Tokie-Skills-Extension/2.0 (+extension; raw.githubusercontent.com)",
};

const SKILLS_SH_SEARCH = "https://skills.sh/api/search";

const SUPPORTED_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "claude.ai",
];

const BODY_TTL_MS = 24 * 60 * 60 * 1000;

const bodyCache = storage.defineItem<Record<
  string,
  { version: 1; fetchedAt: number; raw: string }
>>("local:tokie:skills:bodies:v2", {
  fallback: {},
  version: 1,
});

function cacheKey(source: string, skillId: string): string {
  return `${source}::${skillId}`;
}

function isSupportedUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return SUPPORTED_HOSTS.some(
      (h) => u.hostname === h || u.hostname.endsWith(`.${h}`)
    );
  } catch {
    return false;
  }
}

type SkillsShSearchJson = {
  skills?: Array<{
    id: string;
    skillId: string;
    name: string;
    installs: number;
    source: string;
  }>;
};

type GitHubRepoJson = {
  default_branch?: string;
};

type GitHubTreeJson = {
  tree?: Array<{ path: string; type: string }>;
};

function buildSkillIdVariants(skillId: string): string[] {
  const variants = new Set<string>();
  const add = (v: string) => {
    const n = v.trim();
    if (n) variants.add(n);
  };

  add(skillId);
  add(skillId.replaceAll(":", "-"));
  add(skillId.replaceAll(":", "/"));

  const normalized = skillId.replaceAll(":", "-").replaceAll("/", "-");
  const parts = normalized.split("-").filter(Boolean);
  for (let i = 1; i < parts.length - 1; i++) {
    add(parts.slice(i).join("-"));
  }

  return Array.from(variants);
}

async function resolveDefaultBranch(source: string): Promise<string | null> {
  const repoMetaUrl = `https://api.github.com/repos/${source}`;
  const res = await fetch(repoMetaUrl, { headers: RAW_HEADERS });
  if (!res.ok) return null;
  const data = (await res.json()) as GitHubRepoJson;
  return data.default_branch?.trim() || null;
}

async function tryFetchFromRepoTree(
  source: string,
  branch: string,
  skillIdVariants: string[]
): Promise<string | null> {
  const treeUrl = `https://api.github.com/repos/${source}/git/trees/${encodeURIComponent(
    branch
  )}?recursive=1`;
  const res = await fetch(treeUrl, { headers: RAW_HEADERS });
  if (!res.ok) return null;
  const data = (await res.json()) as GitHubTreeJson;
  const files =
    data.tree
      ?.filter((node) => node.type === "blob")
      .map((node) => node.path)
      .filter(Boolean) ?? [];
  if (!files.length) return null;

  const loweredNeedles = skillIdVariants.map((id) =>
    id.toLowerCase().replaceAll(":", "-").replaceAll("/", "-")
  );
  const candidate = files.find((path) => {
    const lower = path.toLowerCase();
    if (!lower.endsWith("/skill.md") && !lower.endsWith("/readme.md")) {
      return false;
    }
    return loweredNeedles.some((needle) => lower.includes(needle));
  });
  if (!candidate) return null;

  const rawUrl = `https://raw.githubusercontent.com/${source}/${branch}/${candidate}`;
  const rawRes = await fetch(rawUrl, { headers: RAW_HEADERS });
  if (!rawRes.ok) return null;
  return rawRes.text();
}

async function searchSkillsSh(
  query: string,
  limit: number
): Promise<SkillsShHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = `${SKILLS_SH_SEARCH}?q=${encodeURIComponent(q)}&limit=${Math.min(
    limit,
    100
  )}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`skills.sh search failed (${res.status})`);
  }
  const data = (await res.json()) as SkillsShSearchJson & { error?: string };
  if (data.error) {
    throw new Error(data.error);
  }
  const rows = data.skills ?? [];
  return rows.map((s) => ({
    id: s.id,
    skillId: s.skillId,
    name: s.name,
    installs: s.installs,
    source: s.source,
  }));
}

async function fetchSkillMdFromGitHub(
  source: string,
  skillId: string,
  force: boolean
): Promise<string> {
  const key = cacheKey(source, skillId);
  const cache = await bodyCache.getValue();
  const hit = cache[key];
  if (!force && hit && Date.now() - hit.fetchedAt < BODY_TTL_MS) {
    return hit.raw;
  }

  const normalizedSource = source
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/^\/+|\/+$/g, "");
  const defaultBranch = await resolveDefaultBranch(normalizedSource);
  const branches = Array.from(
    new Set([defaultBranch, "main", "master", "trunk", "dev"].filter(Boolean))
  ) as string[];
  const skillIdVariants = buildSkillIdVariants(skillId);
  const encodePathId = (id: string): string =>
    id
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
  const pathPatterns = [
    "skills/{id}/SKILL.md",
    "skills/{id}/skill.md",
    "skills/{id}/README.md",
    "{id}/SKILL.md",
    "{id}/skill.md",
    "{id}/README.md",
  ];
  let lastStatus = 0;
  const attempted: string[] = [];
  for (const branch of branches) {
    for (const id of skillIdVariants) {
      for (const pattern of pathPatterns) {
        const repoPath = pattern.replace("{id}", encodePathId(id));
        const path = `https://raw.githubusercontent.com/${normalizedSource}/${branch}/${repoPath}`;
        if (attempted.includes(path)) continue;
        attempted.push(path);
        const r = await fetch(path, { headers: RAW_HEADERS });
        lastStatus = r.status;
        if (r.ok) {
          const raw = await r.text();
          await bodyCache.setValue({
            ...cache,
            [key]: { version: 1, fetchedAt: Date.now(), raw },
          });
          return raw;
        }
      }
    }
  }
  for (const branch of branches) {
    const viaTree = await tryFetchFromRepoTree(
      normalizedSource,
      branch,
      skillIdVariants
    );
    if (viaTree) {
      await bodyCache.setValue({
        ...cache,
        [key]: { version: 1, fetchedAt: Date.now(), raw: viaTree },
      });
      return viaTree;
    }
  }
  throw new Error(
    `Could not load SKILL.md (${lastStatus}) for ${normalizedSource}/${skillId}. Try another skill or check the repo layout.`
  );
}

export default defineBackground(() => {
  browser.action.onClicked.addListener(async (tab) => {
    if (!tab.id || !isSupportedUrl(tab.url)) {
      await browser.tabs.create({ url: "https://chatgpt.com" });
      return;
    }
    try {
      await browser.tabs.sendMessage(tab.id, { type: "TOGGLE_SKILLS_MODAL" });
    } catch (e) {
      console.warn("[tokie] failed to toggle skills modal:", e);
    }
  });

  browser.runtime.onMessage.addListener(
    (message: MessageRequest, _sender, sendResponse) => {
      if (message?.type === "SEARCH_SKILLS_SH") {
        (async () => {
          try {
            const hits = await searchSkillsSh(
              message.query,
              message.limit ?? 80
            );
            sendResponse({ ok: true, hits });
          } catch (e) {
            sendResponse({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        })();
        return true;
      }

      if (message?.type === "FETCH_SKILL_BODY") {
        (async () => {
          try {
            const body = await fetchSkillMdFromGitHub(
              message.source,
              message.skillId,
              message.force === true
            );
            sendResponse({ ok: true, body });
          } catch (e) {
            sendResponse({
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        })();
        return true;
      }

      return false;
    }
  );
});
