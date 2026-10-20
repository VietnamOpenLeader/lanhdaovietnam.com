import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateCatalogSet } from "../src/i18n/catalogs";
import { locales } from "../src/i18n/locales";

const projectRoot = join(import.meta.dir, "..");

const catalogs = locales.map((locale) => ({
  locale,
  json: readFileSync(join(projectRoot, "src/locales", locale, "messages.json"), "utf8"),
}));

validateCatalogSet(catalogs);
console.log(`Validated Lingui catalogs: ${locales.join(", ")}`);
