import { defineHandler } from "void";
import { env } from "void/env";
import { parseLocale } from "../../src/i18n/locales";
import { createSitemapPage } from "../../src/seo/sitemap.server";

const sitemapPagePattern = /^([^/]+)-(d1|markdown)-([1-9]\d*)\.xml$/u;

export const GET = defineHandler(async (context) => {
  const page = context.req.param("page");
  const match = page ? sitemapPagePattern.exec(page) : null;
  const locale = parseLocale(match?.[1]);
  const source = match?.[2];
  const pageNumber = Number(match?.[3]);
  if (!locale || (source !== "d1" && source !== "markdown") || !Number.isSafeInteger(pageNumber)) {
    return context.notFound();
  }

  const xml = await createSitemapPage(locale, source, pageNumber, env.SITE_URL);
  if (xml === null) return context.notFound();
  context.header("Content-Type", "application/xml; charset=utf-8");
  return context.body(xml, 200);
});
