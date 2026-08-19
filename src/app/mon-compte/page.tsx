import Link from "next/link";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROLE_LABEL_KEYS } from "@/lib/roles";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { getTranslations } from "@/lib/i18n/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordForm } from "./password-form";

export default async function AccountPage() {
  const sessionUser = await requireUser();
  const { t } = await getTranslations();

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { email: true, name: true, role: true, mustChangePassword: true },
  });

  const mustChange = user?.mustChangePassword ?? false;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <span className="flex items-center gap-2 text-primary-800">
          <GraduationCap className="h-6 w-6" strokeWidth={2} />
          <span className="text-lg font-semibold tracking-tight">Madrasati</span>
        </span>
        {!mustChange && (
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        )}
      </div>

      {mustChange && (
        <div className="mb-5 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3">
          <p className="text-sm font-medium text-accent-700">
            Choisissez votre mot de passe
          </p>
          <p className="mt-1 text-sm text-foreground/70">
            Votre mot de passe actuel a été créé par la direction. Pour votre
            sécurité, remplacez-le par un mot de passe que vous seul connaissez.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mon compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-5 pt-0">
          <div className="rounded-lg bg-surface-muted px-4 py-3 text-sm">
            <p className="font-medium text-foreground">{user?.name}</p>
            <p className="text-foreground/60">{user?.email}</p>
            <p className="mt-1 text-xs text-foreground/50">
              {ROLE_LABEL_KEYS[user?.role ?? ""]
                ? t(ROLE_LABEL_KEYS[user!.role] as TranslationKey)
                : user?.role}
            </p>
          </div>

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-foreground/40">
              Changer le mot de passe
            </p>
            <PasswordForm mustChange={mustChange} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
