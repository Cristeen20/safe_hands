import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Next allows one dev server per project. If one is already running (e.g.
// `pnpm dev` on :3000), point the tests at it with E2E_BASE_URL.
const existing = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: existing ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: existing
    ? undefined
    : {
        command: `pnpm dev --port ${PORT}`,
        url: `http://localhost:${PORT}/en-GB`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { BETTER_AUTH_URL: `http://localhost:${PORT}` },
      },
});
