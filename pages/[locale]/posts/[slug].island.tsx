import type { Props } from "./[slug].server";
import ContentDetail from "../../../src/components/ContentDetail";

export default function ContentPage(props: Props) {
  return <ContentDetail {...props} />;
}
