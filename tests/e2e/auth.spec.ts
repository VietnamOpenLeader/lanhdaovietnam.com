import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("login island hydrates and validates required fields without a request", async ({ page }) => {
  const authMutations: string[] = [];
  const consoleErrors: string[] = [];
  const otherLocaleCatalogs: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/auth\/(sign-in|sign-up)\//u.test(request.url())) {
      authMutations.push(request.url());
    }
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("request", (request) => {
    if (/\/src\/locales\/(?:en|zh-CN)\/messages\.ts/u.test(request.url())) {
      otherLocaleCatalogs.push(request.url());
    }
  });

  await page.goto("/vi/login");
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeEnabled();
  await expect(page.getByRole("textbox", { name: "Email" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "GitHub" })).toBeDisabled();

  await page.getByRole("button", { name: "Chưa có tài khoản? Tạo tài khoản" }).click();
  await expect(page.getByRole("textbox", { name: "Tên hiển thị" })).toBeVisible();
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page.getByRole("textbox", { name: "Tên hiển thị" })).toBeFocused();

  expect(authMutations).toEqual([]);
  expect(otherLocaleCatalogs).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("email signup establishes a session that can be signed out", async ({ page }) => {
  const name = "Browser test member";
  await page.goto("/vi/login");
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeEnabled();
  await page.getByRole("button", { name: "Chưa có tài khoản? Tạo tài khoản" }).click();
  await page.getByLabel("Tên hiển thị").fill(name);
  await page.getByLabel("Email").fill(`browser-${randomUUID()}@example.test`);
  await page.getByLabel("Mật khẩu").fill("browser-test-password-123");

  const signupResponse = page.waitForResponse((response) =>
    response.url().includes("/api/auth/sign-up/email") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  expect((await signupResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/vi\/?$/u);

  await page.goto("/vi/login");
  await expect(page.getByText(name)).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
});
