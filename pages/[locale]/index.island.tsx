import type { Props } from "./index.server";
import HomePage from "../../src/components/HomePage";

export default function LocalizedHomePage(props: Props) {
  return <HomePage {...props} />;
}
