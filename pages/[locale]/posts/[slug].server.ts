import { defineHandler, type InferProps } from "void";
import { ContentError } from "../../../src/core/errors";
import { getPublished } from "../../../src/content/programs.server";
import { renderContentMarkdown } from "../../../src/content/render.server";
import { runContentProgram } from "../../../src/content/run.server";
import { listTranslations } from "../../../src/content/catalog.server";
import { routeLocale } from "../../../src/content/home.server";
import { loadMessages } from "../../../src/i18n/runtime";

export const loader = defineHandler(async (context) => {
  const locale = routeLocale(context);
  const slug = context.req.param("slug");
  if (!locale || !slug) return context.notFound();

  try {
    const record = await runContentProgram(getPublished(locale, slug));
    const [messages, translations] = await Promise.all([
      loadMessages(locale),
      listTranslations(record.translationKey, "d1"),
    ]);
    return {
      locale,
      messages,
      title: record.title,
      description: record.description,
      html: renderContentMarkdown(record.body),
      translations,
    };
  } catch (error) {
    if (error instanceof ContentError && error.status === 404) return context.notFound();
    throw error;
  }
});

export type Props = InferProps<typeof loader>;
