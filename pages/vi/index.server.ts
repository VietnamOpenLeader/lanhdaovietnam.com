import { defineHandler, type InferProps } from "void";
import { listCatalog } from "../../src/content/catalog.server";

export const loader = defineHandler(async () => {
  const catalog = await listCatalog({ locale: "vi", limit: 4 });
  const articles = catalog.items
    .map(({ title, description, url }) => ({ title, description, url }));
  return {
    title: "Lãnh đạo Việt Nam",
    description: "Đi về cội nguồn, định hình tương lai.",
    articles,
  };
});

export type Props = InferProps<typeof loader>;
