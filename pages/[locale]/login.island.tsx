import LoginIsland from "../../src/components/LoginIsland" with { island: "load" };
import type { Props } from "./login.server";

export default function LoginPage(props: Props) {
  return (
    <LoginIsland
      availableProviders={props.availableProviders}
      locale={props.locale}
      messages={props.messages}
      userName={props.userName}
    />
  );
}
