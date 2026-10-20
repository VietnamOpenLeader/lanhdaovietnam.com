import { defineHandler, defineHead, type InferProps } from "void";
import { env } from "void/env";
import { loadLocalizedHome, routeLocale } from "../../src/content/home.server";
import { buildHomeHead } from "../../src/seo/head";

export const loader = defineHandler(async (context) => {
  const locale = routeLocale(context);
  if (!locale) return context.notFound();
  return loadLocalizedHome(context, locale);
});

export type Props = InferProps<typeof loader>;

export const head = defineHead<Props>((_context, props) =>
  buildHomeHead({
    locale: props.locale,
    title: props.title,
    description: props.description,
    siteURL: env.SITE_URL,
  })
);
