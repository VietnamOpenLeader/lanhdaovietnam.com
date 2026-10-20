import { defineConfig } from "@playwright/test";

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:4174";
const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const useExistingServer = process.env.TEST_BASE_URL !== undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    headless: true,
    ...(chromiumExecutable
      ? { launchOptions: { executablePath: chromiumExecutable } }
      : {}),
  },
  ...(useExistingServer
    ? {}
    : {
      webServer: {
        command: "bun run dev -- --host 127.0.0.1 --port 4174",
        url: "http://127.0.0.1:4174/api/health",
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
    }),
});
