import { setupI18n, type Messages } from "@lingui/core";
import type { CloudContext } from "void";
import { homePageDescription, homePageTitle } from "../i18n/messages";
import { parseLocale, type Locale } from "../i18n/locales";
import { loadMessages } from "../i18n/runtime";
import { listCatalog } from "./catalog.server";
import { parseContentListQuery } from "./validation.server";

export interface LocalizedHomeData {
  readonly locale: Locale;
  readonly messages: Messages;
  readonly title: string;
  readonly description: string;
  readonly items: Awaited<ReturnType<typeof listCatalog>>["items"];
  readonly kind: "article" | "news" | "event" | null;
  readonly nextCursor: string | null;
}

export async function loadLocalizedHome(
  context: CloudContext,
  locale: Locale,
): Promise<LocalizedHomeData> {
  const params = new URL(context.req.url).searchParams;
  params.set("locale", locale);
  params.set("limit", "20");
  const query = parseContentListQuery(params);
  const catalog = await listCatalog({
    locale,
    ...(query.kind ? { kind: query.kind } : {}),
    limit: query.limit,
    ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
  });
  const messages = await loadMessages(locale);
  const i18n = setupI18n({ locale, messages: { [locale]: messages } });

  return {
    locale,
    messages,
    title: i18n._(homePageTitle),
    description: i18n._(homePageDescription),
    items: catalog.items,
    kind: query.kind ?? null,
    nextCursor: catalog.nextCursor,
  };
}

export function routeLocale(context: CloudContext): Locale | null {
  return parseLocale(context.req.param("locale"));
}
