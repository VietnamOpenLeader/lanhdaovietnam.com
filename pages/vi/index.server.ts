import { defineHandler, type InferProps } from "void";

export const loader = defineHandler(() => ({
  title: "Lãnh đạo Việt Nam",
  description: "Đi về cội nguồn, định hình tương lai.",
}));

export type Props = InferProps<typeof loader>;
