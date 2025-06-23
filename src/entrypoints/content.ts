import initTokenTracker from "./tracker";

export default defineContentScript({
  matches: ["https://chat.openai.com/*", "https://chatgpt.com/*"],
  main() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        initTokenTracker();
      });
    } else {
      initTokenTracker();
    }
  },
});
