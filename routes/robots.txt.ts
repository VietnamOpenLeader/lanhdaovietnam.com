import { defineHandler } from "void";
import { env } from "void/env";

export const GET = defineHandler((context) => {
  context.header("Content-Type", "text/plain; charset=utf-8");
  return context.text(`User-agent: *\nAllow: /\nSitemap: ${new URL("/sitemap.xml", env.SITE_URL)}\n`);
});
