import { setupI18n } from "@lingui/core";
import { defineHandler, defineHead, type InferProps } from "void";
import { getUser } from "void/auth";
import { getConfiguredSocialProviders } from "../../src/auth/admin.server";
import { routeLocale } from "../../src/content/home.server";
import { loginTitle } from "../../src/i18n/messages";
import { loadMessages } from "../../src/i18n/runtime";
import { buildAuthHead } from "../../src/seo/head";

export const loader = defineHandler(async (context) => {
  const locale = routeLocale(context);
  if (!locale) return context.notFound();
  const messages = await loadMessages(locale);
  const i18n = setupI18n({ locale, messages: { [locale]: messages } });
  return {
    locale,
    messages,
    title: i18n._(loginTitle),
    availableProviders: getConfiguredSocialProviders(),
    userName: getUser()?.name ?? null,
  };
});

export type Props = InferProps<typeof loader>;

export const head = defineHead<Props>((_context, props) =>
  buildAuthHead({ locale: props.locale, title: props.title }),
);
