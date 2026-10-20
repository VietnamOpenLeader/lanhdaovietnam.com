import { defineHandler, defineHead, type InferProps } from "void";
import { env } from "void/env";
import { ContentError } from "../../../src/core/errors";
import type { ContentSummary } from "../../../src/content/pagination";
import { getPublished } from "../../../src/content/programs.server";
import { renderContentMarkdown } from "../../../src/content/render.server";
import { runContentProgram } from "../../../src/content/run.server";
import { listTranslations } from "../../../src/content/catalog.server";
import { routeLocale } from "../../../src/content/home.server";
import { loadMessages } from "../../../src/i18n/runtime";
import { buildContentHead } from "../../../src/seo/head";

export const loader = defineHandler(async (context) => {
  const locale = routeLocale(context);
  const slug = context.req.param("slug");
  if (!locale || !slug) return context.notFound();

  try {
    const record = await runContentProgram(getPublished(locale, slug));
    if (!record.publishedAt) {
      throw new ContentError({ status: 500, code: "INTERNAL" });
    }
    const [messages, translations] = await Promise.all([
      loadMessages(locale),
      listTranslations(record.translationKey, "d1"),
    ]);
    const entry: ContentSummary = {
      key: `d1:${record.id}`,
      source: "d1",
      locale: record.locale,
      slug: record.slug,
      kind: record.kind,
      title: record.title,
      description: record.description,
      publishedAt: record.publishedAt,
      startsAt: record.startsAt,
      endsAt: record.endsAt,
      location: record.location,
      url: `/${record.locale}/posts/${record.slug}`,
    };
    return {
      locale,
      messages,
      entry,
      html: renderContentMarkdown(record.body),
      translations,
    };
  } catch (error) {
    if (error instanceof ContentError && error.status === 404) return context.notFound();
    throw error;
  }
});

export type Props = InferProps<typeof loader>;

export const head = defineHead<Props>((_context, props) =>
  buildContentHead({
    entry: props.entry,
    alternates: props.translations,
    siteURL: env.SITE_URL,
  })
);
