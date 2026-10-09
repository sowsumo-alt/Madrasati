"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { useLanguage } from "@/lib/i18n/language-provider";

export function SessionExpired({ loginUrl }: { loginUrl: string }) {
  const { t } = useLanguage();
  useEffect(() => {
    void signOut({ callbackUrl: loginUrl });
  }, [loginUrl]);
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <p className="max-w-sm text-center text-sm text-foreground/70">{t("session.expired")}</p>
    </main>
  );
}
