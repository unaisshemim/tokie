export type Platform = "chatgpt" | "claude";

export interface PlatformConfig {
  platform: Platform;
  composerSelectors: string[];
}

export function detectPlatform(): Platform {
  const hostname = window.location.hostname;
  if (hostname.includes("claude.ai") || hostname.includes("anthropic.com")) {
    return "claude";
  }
  return "chatgpt";
}

export function getPlatformConfig(): PlatformConfig {
  const platform = detectPlatform();

  if (platform === "claude") {
    return {
      platform: "claude",
      composerSelectors: [
        'div[contenteditable="true"][aria-label^="Write"]',
        'div[contenteditable="true"].ProseMirror',
        'div[contenteditable="true"]',
      ],
    };
  }

  return {
    platform: "chatgpt",
    composerSelectors: [
      "#prompt-textarea",
      'div[contenteditable="true"].ProseMirror',
      'textarea[data-testid="prompt-textarea"]',
    ],
  };
}
