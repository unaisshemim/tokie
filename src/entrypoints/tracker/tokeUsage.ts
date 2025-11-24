import { encode } from "gpt-tokenizer";
import { detectPlatform, getPlatformConfig, type Platform } from "./platform";
import { RateLimitInfo } from "./rateLimits";
import { getDefaultTokenLimit } from "./tokenLimits";

export interface TokenUsage {
  sessionId: string;
  sessionStart: number;
  planType: "free" | "plus" | "pro";
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  syncing: boolean;
  maxTokens: number;
  platform?: Platform;
  rateLimit?: RateLimitInfo;
  actualModel?: string; // Detected actual model (may differ from displayed)
  displayedModel?: string; // Model shown in UI
  isDowngraded?: boolean; // True if actualModel differs from displayedModel
}

export const DEFAULT_USAGE: TokenUsage = {
  sessionId: "",
  sessionStart: 0,
  planType: "free",
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  syncing: false,
  maxTokens: 16000,
};

export function getChatGPTSessionId(): string | null {
  if (typeof window === "undefined" || !window.location) return null;
  const match = window.location.pathname.match(/\/c\/([a-z0-9-]+)/i);
  return match ? match[1] : null;
}

export function getSessionId(): string | null {
  const config = getPlatformConfig();
  return config.sessionIdExtractor();
}

export async function loadTokenUsage(sessionId: string): Promise<TokenUsage> {
  const data = await chrome.storage.local.get("tokenUsage");
  const sessions: Record<string, TokenUsage> = data.tokenUsage || {};

  let usage: TokenUsage;
  const platform = detectPlatform();

  if (!sessions[sessionId]) {
    // Use platform-aware default token limit
    const defaultMaxTokens = getDefaultTokenLimit(platform, "free");
    usage = {
      ...DEFAULT_USAGE,
      sessionId,
      sessionStart: Date.now(),
      platform,
      maxTokens: defaultMaxTokens,
    };
  } else {
    usage = sessions[sessionId];
    // Ensure platform is set
    if (!usage.platform) {
      usage.platform = platform;
    }
    // If maxTokens is still the old default, update it
    if (usage.maxTokens === DEFAULT_USAGE.maxTokens) {
      usage.maxTokens = getDefaultTokenLimit(
        platform,
        usage.planType || "free"
      );
    }
  }

  // Update both tokenUsage map and currentSession
  sessions[sessionId] = usage;
  await chrome.storage.local.set({
    tokenUsage: sessions,
    currentSession: usage,
  });

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

export function countTokens(text: string, platform?: Platform): number {
  try {
    const targetPlatform = platform || detectPlatform();

    // Both ChatGPT and Claude use similar tokenization
    // For Claude, we use gpt-tokenizer as an approximation
    // This is close enough for usage tracking purposes
    // Note: Claude's actual tokenizer is slightly different, but the difference
    // is minimal for tracking purposes (typically within 5-10% accuracy)
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
