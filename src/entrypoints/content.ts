import initTokenTracker from "./tracker";
import { getSessionId } from "./tracker/tokeUsage";

let lastSessionId: string | null = null;
let trackerInitialized = false;

function startOrUpdateTracker() {
  const currentSessionId = getSessionId();
  if (currentSessionId !== lastSessionId) {
    lastSessionId = currentSessionId;
    const oldWidget = document.querySelector(".tokie-widget");
    if (oldWidget) oldWidget.remove();
    initTokenTracker();
    trackerInitialized = true;
  }
}

export default defineContentScript({
  matches: [
    "https://chat.openai.com/*",
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://*.claude.ai/*",
  ],
  main() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        startOrUpdateTracker();
      });
    } else {
      startOrUpdateTracker();
    }
    let lastUrl = location.pathname;
    setInterval(() => {
      if (location.pathname !== lastUrl) {
        lastUrl = location.pathname;
        startOrUpdateTracker();
      }
    }, 500);
  },
});
