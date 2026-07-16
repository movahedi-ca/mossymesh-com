import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ESM-safe __dirname (package.json has "type": "module")
const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(rootDir, "index.html"),
        developers: resolve(rootDir, "developers.html"),
        api: resolve(rootDir, "api.html"),
      },
    },
  },
  server: {
    port: 5173,
  },
});
