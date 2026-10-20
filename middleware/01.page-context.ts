import { defineMiddleware } from "void";
import { getConfiguredSocialProviders } from "../src/auth/admin.server";
import { markdownIndex } from "../src/content/manifest.server";
import { markdownTranslations } from "../src/content/markdown";
import { loadMessages } from "../src/i18n/runtime";
import { localeFromPath, type PageContext } from "../src/i18n/page-context";

declare module "void" {
  interface CloudContextVariables {
    shared: { pageContext: PageContext };
  }
}

export default defineMiddleware(async (context, next) => {
  const url = new URL(context.req.url);
  if (url.pathname.startsWith("/api/")) {
    await next();
    return;
  }

  const locale = localeFromPath(url.pathname);
  const markdownPage = markdownIndex.find((entry) => entry.url === url.pathname);
  const translationLinks = markdownPage
    ? markdownTranslations(markdownIndex, markdownPage.translationKey)
    : undefined;
  const pageContext: PageContext = {
    locale,
    path: url.pathname,
    messages: locale ? await loadMessages(locale) : null,
    availableProviders: getConfiguredSocialProviders(),
    ...(translationLinks ? { translationLinks } : {}),
  };
  context.set("shared", { pageContext });
  await next();
});
