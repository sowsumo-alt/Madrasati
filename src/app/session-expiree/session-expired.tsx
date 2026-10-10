"use client";

import { useEffect } from "react";
import { useLanguage } from "@/lib/i18n/language-provider";
import { signOutAndForget } from "@/lib/sign-out";

export function SessionExpired({ loginUrl }: { loginUrl: string }) {
  const { t } = useLanguage();
  useEffect(() => {
    void signOutAndForget(loginUrl);
  }, [loginUrl]);
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <p className="max-w-sm text-center text-sm text-foreground/70">{t("session.expired")}</p>
    </main>
  );
}
