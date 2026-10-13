import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname,
    },
  },
  build: {
    rollupOptions: {
      input: {
        chat: "index.html",
        usage: "usage/index.html",
      },
    },
  },
});
