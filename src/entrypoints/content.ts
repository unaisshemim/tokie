import initTokenTracker from "./tracker";

let lastSessionId: string | null = null;
let trackerInitialized = false;

function getSessionId() {
  const match = window.location.pathname.match(/\/c\/([a-z0-9-]+)/i);
  return match ? match[1] : null;
}

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
  matches: ["https://chat.openai.com/*", "https://chatgpt.com/*"],
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
