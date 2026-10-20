import { expect, test } from "bun:test";
import { loadI18n } from "../../src/i18n/runtime";

test("loads request-isolated UI catalogs for every supported locale", async () => {
  const [vi, en, zh] = await Promise.all([loadI18n("vi"), loadI18n("en"), loadI18n("zh-CN")]);

  expect(vi._("auth.signIn")).toBe("Đăng nhập");
  expect(en._("auth.signIn")).toBe("Sign in");
  expect(zh._("auth.signIn")).toBe("登录");
  expect(vi).not.toBe(en);
  expect(vi._("auth.signIn")).toBe("Đăng nhập");
  expect(JSON.parse(JSON.stringify(vi.messages))).toEqual(vi.messages);
});
