// src/entrypoints/tracker/index.ts
import { interceptNetworkRequests } from "./networkInterceptor";
import { loadTokenUsage, DEFAULT_USAGE, TokenUsage } from "./tokeUsage";
import { createWidget } from "./ui";
import { getChatGPTSessionId } from "./tokeUsage";

function waitForFirstUserInput(): Promise<HTMLElement> {
  return new Promise((resolve) => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const elements = Array.from(
          (mutation.target as HTMLElement).querySelectorAll(
            '[data-message-author-role="user"]'
          )
        );

        for (const el of elements) {
          // Optional: ensure it's not already resolved
          if (el.textContent?.trim()) {
            observer.disconnect();
            resolve(el as HTMLElement);
            return;
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Fallback: check if already present in DOM
    const existing = document.querySelector(
      '[data-message-author-role="user"]'
    );
    if (existing) {
      observer.disconnect();
      resolve(existing as HTMLElement);
    }
  });
}

async function initTokenTracker() {
  console.log("[tracker] Waiting for first user input...");
  await waitForFirstUserInput();
  console.log("[tracker] First user input detected. Initializing tracker...");

  const sessionId = getChatGPTSessionId() || `session-${Date.now()}`;
  sessionStorage.setItem("chatgpt-session-id", sessionId);

  console.log(
    "[tracker] First user message detected. Using session ID:",
    sessionId
  );

  let usage = await loadTokenUsage(sessionId);
  if (!usage) {
    usage = {
      ...DEFAULT_USAGE,
      sessionId,
      sessionStart: Date.now(),
    };
  }

  const widget = createWidget(usage);
  console.log("[tracker] Widget created:", widget);
  interceptNetworkRequests(usage, widget);
}

export default initTokenTracker;
