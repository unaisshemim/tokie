import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";
import path from "path";

export default defineConfig({
  manifest: {
    permissions: ["storage"],
    host_permissions: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
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
