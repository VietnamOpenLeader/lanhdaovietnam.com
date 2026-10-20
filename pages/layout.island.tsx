import type { ReactNode } from "react";
import { useShared } from "@void/react";
import { LocaleProvider } from "../src/i18n/runtime";
import SiteChrome from "../src/components/SiteChrome";
import "../src/styles/app.css";

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const { pageContext } = useShared();
  if (!pageContext.locale || !pageContext.messages) return <>{children}</>;

  return (
    <LocaleProvider locale={pageContext.locale} messages={pageContext.messages}>
      <SiteChrome
        locale={pageContext.locale}
        translationLinks={pageContext.translationLinks}
      >
        {children}
      </SiteChrome>
    </LocaleProvider>
  );
}
