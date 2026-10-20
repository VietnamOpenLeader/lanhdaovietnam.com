import type { Messages } from "@lingui/core";
import { parseLocale, type Locale } from "./locales";
import type { SocialProvider } from "../auth/social-providers";
import type { ContentSummary } from "../content/pagination";

export interface PageContext {
  readonly locale: Locale | null;
  readonly path: string;
  readonly messages: Messages | null;
  readonly availableProviders: ReadonlyArray<SocialProvider>;
  readonly translationLinks?: ReadonlyArray<ContentSummary>;
}

export function localeFromPath(path: string): Locale | null {
  const pathLocale = path.split("/")[1];
  return parseLocale(pathLocale);
}
