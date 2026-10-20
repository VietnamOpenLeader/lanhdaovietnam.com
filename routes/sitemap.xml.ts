import { defineHandler } from "void";
import { env } from "void/env";
import { createSitemapIndex } from "../src/seo/sitemap.server";

export const GET = defineHandler(async (context) => {
  context.header("Content-Type", "application/xml; charset=utf-8");
  return context.body(await createSitemapIndex(env.SITE_URL), 200);
});
