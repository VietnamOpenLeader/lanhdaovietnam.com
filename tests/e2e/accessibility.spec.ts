import { expect, test } from "@playwright/test";

test("login supports keyboard use and a narrow reduced-motion viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/vi/login");

  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeEnabled();
  const email = page.getByRole("textbox", { name: "Email" });
  const password = page.getByRole("textbox", { name: "Mật khẩu" });
  await expect(email).toHaveAttribute("autocomplete", "email");
  await expect(password).toHaveAttribute("autocomplete", "current-password");
  await email.focus();
  await page.keyboard.press("Tab");
  await expect(password).toBeFocused();

  await page.getByRole("button", { name: "Chưa có tài khoản? Tạo tài khoản" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Tạo tài khoản" })).toBeVisible();
  await expect(page.locator("#login-name")).toHaveAttribute("autocomplete", "name");

  const width = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(width.scrollWidth).toBeLessThanOrEqual(width.viewportWidth);
});
