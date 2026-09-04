import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./smoke",
  testMatch: "**/*.spec.ts",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173 --config vite.smoke.config.ts",
    url: "http://127.0.0.1:4173/smoke/privacy-guardian-harness.html",
    // Opt in when the runner's child-process lifecycle is unreliable on a
    // workstation; CI still starts a fresh server by default.
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    timeout: 120_000,
    // Keep inherited terminal color flags from producing Node's NO_COLOR warning.
    env: {
      NO_COLOR: "",
      FORCE_COLOR: "0",
    },
  },
});
