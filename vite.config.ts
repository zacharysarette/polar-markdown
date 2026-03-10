import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { readFileSync } from "fs";

const host = process.env.TAURI_DEV_HOST;
const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

export default defineConfig(async () => ({
  plugins: [svelte()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          mermaid: ["mermaid"],
          codemirror: [
            "codemirror",
            "@codemirror/view",
            "@codemirror/state",
            "@codemirror/lang-markdown",
            "@codemirror/language",
            "@codemirror/lint",
            "@lezer/highlight",
            "@replit/codemirror-vim",
          ],
          highlight: ["highlight.js"],
          marked: ["marked"],
        },
      },
    },
  },
}));
