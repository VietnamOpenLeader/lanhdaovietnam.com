import { defineHandler, type InferProps } from "void";
import { getUser } from "void/auth";
import { getConfiguredSocialProviders } from "../../src/auth/admin.server";
import { routeLocale } from "../../src/content/home.server";
import { loadMessages } from "../../src/i18n/runtime";

export const loader = defineHandler(async (context) => {
  const locale = routeLocale(context);
  if (!locale) return context.notFound();
  return {
    locale,
    messages: await loadMessages(locale),
    availableProviders: getConfiguredSocialProviders(),
    userName: getUser()?.name ?? null,
  };
});

export type Props = InferProps<typeof loader>;
