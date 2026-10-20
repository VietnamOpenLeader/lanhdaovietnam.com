import { defineHandler, defineHead, type InferProps } from "void";
import { env } from "void/env";
import { buildHomeHead } from "../../src/seo/head";
import { loadLocalizedHome } from "../../src/content/home.server";

export const loader = defineHandler((context) => {
  return loadLocalizedHome(context, "vi");
});

export type Props = InferProps<typeof loader>;

export const head = defineHead<Props>((_context, props) =>
  buildHomeHead({
    locale: props.locale,
    title: props.title,
    description: props.description,
    siteURL: env.SITE_URL,
  }),
);
