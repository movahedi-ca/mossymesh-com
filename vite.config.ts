import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        developers: resolve(__dirname, "developers.html"),
        api: resolve(__dirname, "api.html"),
      },
    },
  },
  server: {
    port: 5173,
  },
});
