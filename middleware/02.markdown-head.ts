import { defineMiddleware } from "void";
import { env } from "void/env";
import { buildContentHead } from "../src/seo/head";
import { getMarkdownEntry, getMarkdownTranslations } from "../src/content/manifest.server";
import { markdownSummary } from "../src/content/markdown";

export default defineMiddleware(async (context, next) => {
  const path = new URL(context.req.url).pathname;
  const entry = getMarkdownEntry(path);
  if (entry) {
    context.set(
      "headDefaults",
      buildContentHead({
        entry: markdownSummary(entry),
        alternates: getMarkdownTranslations(entry.translationKey),
        siteURL: env.SITE_URL,
      }),
    );
  }
  await next();
});
