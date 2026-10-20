import { defineConfig } from "@lingui/cli";
import { formatter } from "@lingui/format-json";
import { locales, sourceLocale } from "./src/i18n/locales";

export default defineConfig({
  locales: [...locales],
  sourceLocale,
  catalogs: [{
    path: "src/locales/{locale}/messages",
    include: ["src"],
  }],
  format: formatter({
    style: "lingui",
    origins: true,
    lineNumbers: false,
  }),
});
