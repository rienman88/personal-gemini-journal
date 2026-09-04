import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Matches server/src/index.ts's static-file path (../../web-dist from
  // server/lib/src/index.js) — kept as one clearly-named build output
  // directory at the repo root instead of nested inside web/.
  build: {
    outDir: "../web-dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Keep Firebase's browser SDK out of the application entry chunk.
        manualChunks: {
          firebase: ["firebase/app", "firebase/app-check", "firebase/auth", "firebase/firestore"],
        },
      },
    },
  },
});
