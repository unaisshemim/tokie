// src/entrypoints/tracker/index.ts
import { interceptNetworkRequests } from "./networkInterceptor";
import { loadTokenUsage, DEFAULT_USAGE, TokenUsage } from "./tokeUsage";
import { createWidget } from "./ui";
import { getChatGPTSessionId } from "./tokeUsage";

function waitForFirstUserInput(): Promise<HTMLElement> {
  return new Promise((resolve) => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            (node as HTMLElement).getAttribute("data-message-author-role") ===
              "user"
          ) {
            observer.disconnect();
            resolve(node as HTMLElement);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

async function initTokenTracker() {
  console.log("[tracker] Waiting for first user input...");
  await waitForFirstUserInput();

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
  interceptNetworkRequests(usage, widget);
}

export default initTokenTracker;
