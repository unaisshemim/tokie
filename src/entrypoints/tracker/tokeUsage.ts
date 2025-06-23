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
  maxTokens: 128000,
};

export function getChatGPTSessionId(): string | null {
  if (typeof window === "undefined" || !window.location) return null;
  const match = window.location.pathname.match(/\/c\/([a-z0-9-]+)/i);
  return match ? match[1] : null;
}

export async function loadTokenUsage(
  sessionId: string
): Promise<TokenUsage | null> {
  console.log("[tokenUsage] Loading usage for session:", sessionId);
  try {
    const data = await chrome.storage.local.get(sessionId);
    if (!data[sessionId]) {
      console.log(
        "[tokenUsage] No existing data found for session:",
        sessionId
      );
      return null;
    }
    console.log("[tokenUsage] Found existing data:", data[sessionId]);
    return data[sessionId];
  } catch (error) {
    console.error("[tokenUsage] Error loading usage:", error);
    return null;
  }
}

export async function saveTokenUsage(usage: TokenUsage): Promise<void> {
  if (!usage.sessionId) {
    console.error("[tokenUsage] Cannot save usage without sessionId:", usage);
    return;
  }
  console.log("[tokenUsage] Saving usage for session:", usage.sessionId);
  try {
    usage.syncing = true;
    // Update UI to show syncing state
    await chrome.storage.local.set({ [usage.sessionId]: usage });
    console.log("[tokenUsage] Successfully saved usage");
    usage.syncing = false;
    // Update UI again to show syncing complete
    await chrome.storage.local.set({ [usage.sessionId]: usage });
  } catch (error) {
    console.error("[tokenUsage] Error saving usage:", error);
    usage.syncing = false;
    // Update UI to show sync failed
    await chrome.storage.local.set({ [usage.sessionId]: usage });
  }
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
