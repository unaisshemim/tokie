import { loadTokenUsage, DEFAULT_USAGE, TokenUsage } from "./tokeUsage";
import { createWidget } from "./ui";
import { getSessionId } from "./tokeUsage";
import { startMessageObserver } from "./observer";
import { getPlatformConfig, detectPlatform } from "./platform";
import { detectUserPlan } from "./planDetection";
import { getTokenLimit } from "./tokenLimits";

function waitForFirstUserInput(): Promise<HTMLElement> {
  const config = getPlatformConfig();
  
  return new Promise((resolve) => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.target instanceof Element) {
          const elements = Array.from(
            mutation.target.querySelectorAll(config.userMessageSelector)
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

    const existing = document.querySelector(config.userMessageSelector);
    if (existing) {
      observer.disconnect();
      resolve(existing as HTMLElement);
    }
  });
}

async function initTokenTracker() {
  const platform = detectPlatform();
  const sessionId = getSessionId() || `${platform}-session-${Date.now()}`;
  sessionStorage.setItem(`${platform}-session-id`, sessionId);

  let usage = await loadTokenUsage(sessionId);
  if (!usage) {
    usage = {
      ...DEFAULT_USAGE,
      sessionId,
      sessionStart: Date.now(),
      platform,
    };
  } else {
    // Ensure platform is set
    usage.platform = platform;
  }

  // Detect plan and model on initialization
  // Wait a bit for the DOM to be ready
  setTimeout(() => {
    const detectedPlan = detectUserPlan(platform);
    if (detectedPlan && detectedPlan !== usage.planType) {
      usage.planType = detectedPlan;
      // Update token limit based on detected plan
      usage.maxTokens = getTokenLimit(platform, detectedPlan, usage.displayedModel);
    }
  }, 1000);

  console.log("[tracker] Token usage loaded:", usage);
  const widget = createWidget(usage);
  startMessageObserver(usage, widget);
  await waitForFirstUserInput();
}

export default initTokenTracker;
