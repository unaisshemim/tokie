import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    permissions: ["storage"],
    host_permissions: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
  },
  srcDir: "src",
  modules: ["@wxt-dev/auto-icons"],
});
