export type Platform = "chatgpt" | "claude";

export interface PlatformConfig {
  platform: Platform;
  userMessageSelector: string;
  assistantMessageSelector: string;
  messageContainerSelector: string;
  sessionIdExtractor: () => string | null;
}

export function detectPlatform(): Platform {
  const hostname = window.location.hostname;
  if (hostname.includes("claude.ai") || hostname.includes("anthropic.com")) {
    return "claude";
  }
  if (
    hostname.includes("chat.openai.com") ||
    hostname.includes("chatgpt.com")
  ) {
    return "chatgpt";
  }
  return "chatgpt"; // default fallback
}

export function getClaudeSessionId(): string | null {
  // Claude URLs might have different patterns
  // For now, generate a session ID based on the conversation
  // We can extract from URL if there's a pattern, or use a hash of the page
  const pathname = window.location.pathname;
  const match = pathname.match(/\/chat\/([a-z0-9-]+)/i);
  if (match) return match[1];
  
  // If no URL pattern, generate a session ID based on current conversation
  // We'll use a combination of timestamp and pathname hash
  const hash = pathname.split("/").filter(Boolean).join("-");
  if (hash) {
    return `claude-${hash}`;
  }
  return `claude-session-${Date.now()}`;
}

export function getChatGPTSessionId(): string | null {
  const match = window.location.pathname.match(/\/c\/([a-z0-9-]+)/i);
  return match ? match[1] : null;
}

export function getPlatformConfig(): PlatformConfig {
  const platform = detectPlatform();
  
  if (platform === "claude") {
    return {
      platform: "claude",
      userMessageSelector: '[data-testid="user-message"]',
      assistantMessageSelector: '[data-is-streaming], .font-claude-response',
      messageContainerSelector: '[data-test-render-count]',
      sessionIdExtractor: getClaudeSessionId,
    };
  }
  
  // ChatGPT default
  return {
    platform: "chatgpt",
    userMessageSelector: '[data-message-author-role="user"]',
    assistantMessageSelector: '[data-message-author-role="assistant"]',
    messageContainerSelector: "article",
    sessionIdExtractor: getChatGPTSessionId,
  };
}

