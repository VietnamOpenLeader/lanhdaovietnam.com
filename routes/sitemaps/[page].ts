import { defineHandler } from "void";
import { env } from "void/env";
import { parseLocale } from "../../src/i18n/locales";
import { createSitemapPage } from "../../src/seo/sitemap.server";

const sitemapPagePattern = /^(vi|en|zh-CN)-([1-9]\d*)\.xml$/u;

export const GET = defineHandler(async (context) => {
  const page = context.req.param("page");
  const match = page ? sitemapPagePattern.exec(page) : null;
  const locale = parseLocale(match?.[1]);
  const pageNumber = Number(match?.[2]);
  if (!locale || !Number.isSafeInteger(pageNumber)) return context.notFound();

  const xml = await createSitemapPage(locale, pageNumber, env.SITE_URL);
  if (xml === null) return context.notFound();
  context.header("Content-Type", "application/xml; charset=utf-8");
  return context.body(xml, 200);
});
