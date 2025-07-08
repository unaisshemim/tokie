import { loadTokenUsage, DEFAULT_USAGE, TokenUsage } from "./tokeUsage";
import { createWidget } from "./ui";
import { getChatGPTSessionId } from "./tokeUsage";
import { startMessageObserver } from "./observer";

function waitForFirstUserInput(): Promise<HTMLElement> {
  return new Promise((resolve) => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.target instanceof Element) {
          const elements = Array.from(
            mutation.target.querySelectorAll(
              '[data-message-author-role="user"]'
            )
          );

          for (const el of elements) {
            if (el.textContent?.trim()) {
              observer.disconnect();
              resolve(el as HTMLElement);
              return;
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

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
  const sessionId = getChatGPTSessionId() || `session-${Date.now()}`;
  sessionStorage.setItem("chatgpt-session-id", sessionId);

  let usage = await loadTokenUsage(sessionId);
  if (!usage) {
    usage = {
      ...DEFAULT_USAGE,
      sessionId,
      sessionStart: Date.now(),
    };
  }
  console.log("[tracker] Token usage loaded:", usage);
  const widget = createWidget(usage);
  startMessageObserver(usage, widget);
  await waitForFirstUserInput();
}

export default initTokenTracker;
