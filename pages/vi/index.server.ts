import { defineHandler, type InferProps } from "void";
import { markdownIndex } from "../../src/content/manifest.server";

export const loader = defineHandler(() => {
  const articles = markdownIndex
    .filter((article) => article.locale === "vi")
    .slice(0, 4)
    .map(({ title, description, url }) => ({ title, description, url }));
  return {
    title: "Lãnh đạo Việt Nam",
    description: "Đi về cội nguồn, định hình tương lai.",
    articles,
  };
});

export type Props = InferProps<typeof loader>;
