import { chromium, type FullConfig } from "@playwright/test";

const readyButton = 'button[type="submit"]:not([disabled])';

async function warmLoginIsland(baseURL: string): Promise<void> {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });

  try {
    const page = await browser.newPage();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await page.goto(`${baseURL}/vi/login`, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        if (response?.status() !== 200) throw new Error("Login page did not return HTTP 200.");
        await page.locator(readyButton).waitFor({ state: "visible", timeout: 15_000 });
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.locator(readyButton).waitFor({ state: "visible", timeout: 15_000 });
        return;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const configuredBaseURL = config.projects[0]?.use.baseURL;
  const baseURL =
    process.env.TEST_BASE_URL ??
    (typeof configuredBaseURL === "string" ? configuredBaseURL : undefined);
  if (!baseURL) throw new Error("Playwright requires a configured baseURL.");
  await warmLoginIsland(baseURL);
}
