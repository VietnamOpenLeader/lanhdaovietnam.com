import { defineHandler, type InferProps } from "void";
import { loadLocalizedHome, routeLocale } from "../../src/content/home.server";

export const loader = defineHandler(async (context) => {
  const locale = routeLocale(context);
  if (!locale) return context.notFound();
  return loadLocalizedHome(context, locale);
});

export type Props = InferProps<typeof loader>;
