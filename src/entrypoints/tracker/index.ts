import { interceptNetworkRequests } from "./networkInterceptor";
import { loadTokenUsage, DEFAULT_USAGE, TokenUsage } from "./tokeUsage";
import { createWidget } from "./ui";
import { getChatGPTSessionId } from "./tokeUsage";
import { startMessageObserver } from "./observer";

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

    const existing = document.querySelector(
      '[data-message-author-role="user"]'
    );
    if (existing) {
      observer.disconnect();
      resolve(existing as HTMLElement);
    }
  });
}

function setupFetchInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const [url] = args;
    const response = await originalFetch(...args);

    if (String(url).includes("/backend-api/conversation")) {
      console.log("[tracker] Intercepted fetch response for:", url);
      const clonedResponse = response.clone();
      readStream(clonedResponse);
    }

    return response;
  };
}

async function readStream(response: Response) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  if (!reader) return;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log("[tracker] Stream finished.");
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      if (event.startsWith("data: ")) {
        const data = event.substring(6);
        if (data.trim() === "[DONE]") {
          console.log("[tracker] End of stream marker [DONE] received.");
          continue;
        }
        try {
          const jsonData = JSON.parse(data);
          chrome.runtime.sendMessage({
            type: "CHATGPT_STREAM_DATA",
            payload: jsonData,
          });
        } catch (e) {
          console.error(
            "[tracker] Error parsing stream JSON:",
            e,
            "Raw data:",
            data
          );
        }
      }
    }
  }
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
