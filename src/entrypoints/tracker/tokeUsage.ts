import { encode } from "gpt-tokenizer";

export interface TokenUsage {
  sessionId: string;
  sessionStart: number;
  planType: "free" | "plus";
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  syncing: boolean;
  maxTokens: number;
}

export const DEFAULT_USAGE: TokenUsage = {
  sessionId: "",
  sessionStart: 0,
  planType: "free",
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  syncing: false,
  maxTokens: 14000,
};

export function getChatGPTSessionId(): string | null {
  if (typeof window === "undefined" || !window.location) return null;
  const match = window.location.pathname.match(/\/c\/([a-z0-9-]+)/i);
  return match ? match[1] : null;
}

export async function loadTokenUsage(sessionId: string): Promise<TokenUsage> {
  const data = await chrome.storage.local.get("tokenUsage");
  const sessions: Record<string, TokenUsage> = data.tokenUsage || {};

  let usage: TokenUsage;

  if (!sessions[sessionId]) {
    usage = {
      ...DEFAULT_USAGE,
      sessionId,
      sessionStart: Date.now(),
    };
  } else {
    usage = sessions[sessionId];
  }

  // Update both tokenUsage map and currentSession
  sessions[sessionId] = usage;
  await chrome.storage.local.set({
    tokenUsage: sessions,
    currentSession: usage,
  });
  console.log("load token usage", usage);

  return usage;
}

export async function saveTokenUsage(usage: TokenUsage): Promise<void> {
  if (!usage.sessionId) return;

  const data = await chrome.storage.local.get("tokenUsage");
  const sessions: Record<string, TokenUsage> = data.tokenUsage || {};

  sessions[usage.sessionId] = usage;

  await chrome.storage.local.set({
    tokenUsage: sessions,
    currentSession: usage,
  });
}

export function countTokens(text: string): number {
  try {
    const tokens = encode(text);
    return tokens.length;
  } catch (e) {
    console.error("[tokenUsage] Failed to count tokens:", e);
    return 0;
  }
}

export async function setCurrentSession(usage: TokenUsage) {
  await chrome.storage.local.set({ currentSession: usage });
}

export async function getCurrentSession(): Promise<TokenUsage | null> {
  const data = await chrome.storage.local.get("currentSession");
  return data.currentSession || null;
}
