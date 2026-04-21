import type { MessageRequest } from "@/skills/messages";
import { mountFloatingLauncher } from "@/skills/floatingLauncher";

function openSkillsModal() {
  void import("@/skills").then(({ toggleSkillsModal }) =>
    toggleSkillsModal()
  );
}

export default defineContentScript({
  matches: [
    "https://chat.openai.com/*",
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://*.claude.ai/*",
  ],
  main() {
    mountFloatingLauncher(openSkillsModal);

    browser.runtime.onMessage.addListener((message: MessageRequest) => {
      if (message?.type === "TOGGLE_SKILLS_MODAL") {
        openSkillsModal();
      }
    });
  },
});
