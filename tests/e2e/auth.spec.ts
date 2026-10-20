import { expect, test } from "@playwright/test";

test("login island hydrates and validates required fields without a request", async ({ page }) => {
  const authMutations: string[] = [];
  const consoleErrors: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/auth\/(sign-in|sign-up)\//u.test(request.url())) {
      authMutations.push(request.url());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/vi/login");
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeEnabled();
  await expect(page.getByRole("textbox", { name: "Email" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "GitHub" })).toBeDisabled();

  await page.getByRole("button", { name: "Chưa có tài khoản? Tạo tài khoản" }).click();
  await expect(page.getByRole("textbox", { name: "Tên hiển thị" })).toBeVisible();
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page.getByRole("textbox", { name: "Tên hiển thị" })).toBeFocused();

  expect(authMutations).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
