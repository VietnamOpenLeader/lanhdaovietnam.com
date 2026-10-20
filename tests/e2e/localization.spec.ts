import { expect, test } from "@playwright/test";

test("language links follow published Markdown counterparts", async ({ page }) => {
  const loginModules: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("LoginIsland") || url.includes("login-machine")) {
      loginModules.push(url);
    }
  });

  await page.goto("/vi/library/khoi-nguon");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  expect(loginModules).toEqual([]);

  await page
    .getByRole("navigation", { name: "Ngôn ngữ" })
    .getByRole("link", { name: "English", exact: true })
    .click();

  await expect(page).toHaveURL(/\/en\/library\/origins\/?$/u);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Origins");
});
