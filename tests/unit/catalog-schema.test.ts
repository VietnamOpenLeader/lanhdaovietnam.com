import { expect, test } from "bun:test";
import { validateCatalogSet } from "../../src/i18n/catalogs";

const catalog = (message: string, translation = message) =>
  JSON.stringify({
    "auth.signIn": {
      translation,
      message,
      comments: ["Sign in button"],
      placeholders: {},
      origin: [["src/i18n/messages.ts"]],
    },
  });

test("accepts complete catalogs and rejects missing locale messages", () => {
  expect(() =>
    validateCatalogSet([
      { locale: "vi", json: catalog("Đăng nhập") },
      { locale: "en", json: catalog("Đăng nhập", "Sign in") },
      { locale: "zh-CN", json: catalog("Đăng nhập", "登录") },
    ]),
  ).not.toThrow();

  expect(() =>
    validateCatalogSet([
      { locale: "vi", json: catalog("Đăng nhập") },
      { locale: "en", json: JSON.stringify({}) },
      { locale: "zh-CN", json: catalog("Đăng nhập", "登录") },
    ]),
  ).toThrow();
});

test("rejects malformed translations and extra catalog fields", () => {
  expect(() =>
    validateCatalogSet([
      { locale: "vi", json: catalog("Đăng nhập") },
      { locale: "en", json: catalog("Đăng nhập", "Sign in") },
      {
        locale: "zh-CN",
        json: JSON.stringify({
          "auth.signIn": { translation: 42, unexpected: "not part of the catalog contract" },
        }),
      },
    ]),
  ).toThrow();
});
