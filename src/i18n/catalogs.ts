import Ajv, { type ValidateFunction } from "ajv";
import { sourceLocale, locales, type Locale } from "./locales";
import schema from "../../schemas/lingui-catalog.schema.json";

export interface CatalogMessage {
  readonly message: string;
  readonly translation: string;
  readonly comments: ReadonlyArray<string>;
  readonly origin: ReadonlyArray<ReadonlyArray<string | number>>;
  readonly placeholders: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly context?: string;
  readonly obsolete?: boolean;
}

export type LinguiCatalog = Readonly<Record<string, CatalogMessage>>;

export interface CatalogSource {
  readonly locale: Locale;
  readonly json: string;
}

const ajv = new Ajv({
  allErrors: true,
  strict: true,
});
const validator: ValidateFunction<LinguiCatalog> = ajv.compile(schema);

function parseCatalog(source: CatalogSource): LinguiCatalog {
  let parsed: object;
  try {
    parsed = JSON.parse(source.json);
  } catch {
    throw new Error(`Invalid JSON in ${source.locale} catalog`);
  }
  if (!validator(parsed)) {
    const details = ajv.errorsText(validator.errors);
    throw new Error(`Invalid ${source.locale} catalog: ${details}`);
  }
  return parsed;
}

function assertTranslations(source: LinguiCatalog, target: LinguiCatalog, locale: Locale): void {
  const sourceIds = Object.keys(source).sort();
  const targetIds = Object.keys(target).sort();
  if (
    sourceIds.length !== targetIds.length ||
    sourceIds.some((id, index) => id !== targetIds[index])
  ) {
    throw new Error(`${locale} catalog message IDs differ from ${sourceLocale}`);
  }
  const sourceMissing = sourceIds.find((id) => source[id].translation.trim().length === 0);
  if (sourceMissing) {
    throw new Error(`${sourceLocale} source message is missing: ${sourceMissing}`);
  }
  const sourceOutOfSync = sourceIds.find((id) => source[id].translation !== source[id].message);
  if (sourceOutOfSync) {
    throw new Error(`${sourceLocale} source message is out of sync: ${sourceOutOfSync}`);
  }
  const missing = targetIds.find((id) => target[id].translation.trim().length === 0);
  if (missing) throw new Error(`${locale} catalog is missing translation: ${missing}`);
}

export function validateCatalogSet(catalogs: ReadonlyArray<CatalogSource>): void {
  const byLocale = new Map<Locale, LinguiCatalog>();
  for (const source of catalogs) {
    if (byLocale.has(source.locale)) throw new Error(`Duplicate catalog locale: ${source.locale}`);
    byLocale.set(source.locale, parseCatalog(source));
  }
  if (byLocale.size !== locales.length || locales.some((locale) => !byLocale.has(locale))) {
    throw new Error(`Expected catalogs for: ${locales.join(", ")}`);
  }
  const source = byLocale.get(sourceLocale);
  if (!source) throw new Error(`Missing source catalog: ${sourceLocale}`);
  for (const locale of locales) {
    if (locale === sourceLocale) continue;
    const target = byLocale.get(locale);
    if (!target) throw new Error(`Missing catalog: ${locale}`);
    assertTranslations(source, target, locale);
  }
}
