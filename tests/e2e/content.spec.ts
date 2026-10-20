import { expect, test } from "@playwright/test";

test("localized content is server-rendered and filters stay within the locale", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/en/");
  await expect(page.getByRole("heading", { name: "Leaders of Vietnam" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read more" })).toHaveAttribute(
    "href",
    "/en/library/origins",
  );
  await page.getByRole("link", { name: "News" }).click();
  await expect(page).toHaveURL(/\/en\?kind=news/u);
  await expect(page.getByText("No content yet.")).toBeVisible();

  await page.goto("/vi/library/khoi-nguon");
  await expect(page.getByRole("heading", { name: /Khởi nguồn/u })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Ngôn ngữ" })
    .getByRole("link", { name: "English" })).toHaveAttribute(
      "href",
      "/en/library/origins",
    );

  expect(consoleErrors).toEqual([]);
});

test("unsupported locales and missing published posts return not found", async ({ page }) => {
  expect((await page.goto("/cn/"))?.status()).toBe(404);
  expect((await page.goto("/vi/posts/missing-article"))?.status()).toBe(404);
});
