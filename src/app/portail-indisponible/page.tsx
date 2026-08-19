import { Lock, MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/brand/logo";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { buttonVariants } from "@/components/ui/button";
import { SignOutButton } from "@/app/compte-suspendu/sign-out-button";

/**
 * Écran d'atterrissage d'un parent dont l'école n'a pas (ou plus) le portail
 * parents — une fonctionnalité de la formule Avancé.
 *
 * Cette page existe pour une raison précise : la garde de fonctionnalité
 * renvoyait ces comptes vers « / », qui les renvoyait aussitôt vers /parent,
 * lui-même verrouillé. Le navigateur bouclait et affichait
 * ERR_TOO_MANY_REDIRECTS — un parent d'école Standard ne pouvait donc
 * jamais se connecter. Un rôle dont la page d'accueil est elle-même
 * verrouillée a besoin d'une sortie qui ne repasse pas par l'accueil.
 */
export default async function ParentPortalUnavailablePage() {
  const user = await requireUser();
  const school = user.schoolId
    ? await prisma.school.findUnique({
        where: { id: user.schoolId },
        select: { name: true, phone: true },
      })
    : null;

  const message = `Bonjour, je suis parent d'élève à ${school?.name ?? "votre école"} et je souhaite accéder au portail parents Madrasati.`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <Logo className="mx-auto h-12 w-12" />
        <span className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Lock className="h-6 w-6" strokeWidth={2} />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-foreground">
          Portail parents non disponible
        </h1>
        <p className="mt-2 text-sm text-foreground/60">
          {school?.name ?? "Votre école"} n&apos;a pas activé le portail parents. Vos
          identifiants restent valables : l&apos;accès s&apos;ouvrira dès que
          l&apos;école l&apos;aura activé. Contactez la direction pour en savoir plus.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {school?.phone && (
            <a
              href={buildWhatsAppUrl(school.phone, message)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "primary" })}
            >
              <MessageCircle className="h-4 w-4" />
              Contacter l&apos;école
            </a>
          )}
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
