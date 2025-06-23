import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    permissions: [
      "activeTab",
      "storage",
      "webRequest",
      "declarativeNetRequest",
    ],
    host_permissions: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
  },
  srcDir: "src",
});
