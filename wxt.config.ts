import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";
import path from "path";

export default defineConfig({
  manifest: {
    action: {},
    permissions: ["storage", "activeTab"],
    web_accessible_resources: [
      {
        resources: ["icon/*.png"],
        matches: ["<all_urls>"],
      },
    ],
    host_permissions: [
      "https://chatgpt.com/*",
      "https://chat.openai.com/*",
      "https://claude.ai/*",
      "https://*.claude.ai/*",
      "https://skills.sh/*",
      "https://raw.githubusercontent.com/*",
    ],
  },
  srcDir: "src",
  modules: ["@wxt-dev/auto-icons"],

  vite: () => ({
    json: {
      stringify: true,
    },
    plugins: [tailwindcss()],
    build: {
      target: "esnext", // ensure Web Animation API compatibility
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"), // or "./src" if using src directory
      },
    },
  }),
});
