import { defineHandler, type InferProps } from "void";
import { loadLocalizedHome } from "../../src/content/home.server";

export const loader = defineHandler((context) => {
  return loadLocalizedHome(context, "vi");
});

export type Props = InferProps<typeof loader>;
