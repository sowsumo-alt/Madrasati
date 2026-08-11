"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { LanguageProvider } from "@/lib/i18n/language-provider";
import type { Locale } from "@/lib/i18n/dictionaries";

export function Providers({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  return (
    <SessionProvider>
      <LanguageProvider initialLocale={initialLocale}>{children}</LanguageProvider>
    </SessionProvider>
  );
}
