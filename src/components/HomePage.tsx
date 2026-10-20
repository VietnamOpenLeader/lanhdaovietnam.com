import { LocaleProvider } from "../i18n/runtime";
import type { LocalizedHomeData } from "../content/home.server";
import ContentList from "./ContentList";

export default function HomePage(props: LocalizedHomeData) {
  return (
    <LocaleProvider locale={props.locale} messages={props.messages}>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">{props.title}</h1>
        <p className="mt-3 max-w-2xl text-sm">{props.description}</p>
        <ContentList
          locale={props.locale}
          items={props.items}
          kind={props.kind}
          nextCursor={props.nextCursor}
        />
      </main>
    </LocaleProvider>
  );
}
