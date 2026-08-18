import { Clock, MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/brand/logo";
import { buildWhatsAppUrl, fillTemplate } from "@/lib/whatsapp";
import { CONTACT_PHONE } from "@/lib/contact";
import { buttonVariants } from "@/components/ui/button";
import { SignOutButton } from "@/app/compte-suspendu/sign-out-button";

const ACTIVATION_MESSAGE_TEMPLATE =
  "Bonjour, je viens de créer mon école {schoolName} sur Madrasati ({city}). " +
  "Je suis {directorName}, joignable au {phone}. J'aimerais qu'on active mon compte.";

/**
 * Écran d'attente d'une école qui vient de s'inscrire : le compte existe, mais
 * l'éditeur ne l'a pas encore activée depuis le tableau de bord Super Admin.
 *
 * N'appelle jamais requireRole — c'est requireRole qui redirige ici, l'utiliser
 * de nouveau créerait une boucle de redirections.
 */
export default async function PendingActivationPage() {
  const user = await requireUser();

  const account = user.schoolId
    ? await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true, school: { select: { name: true, city: true, phone: true } } },
      })
    : null;

  const schoolName = account?.school.name ?? "votre école";
  const message = fillTemplate(ACTIVATION_MESSAGE_TEMPLATE, {
    schoolName,
    city: account?.school.city ?? "",
    directorName: account?.name ?? "",
    phone: account?.school.phone ?? "",
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <Logo className="mx-auto h-12 w-12" />
        <span className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary-700">
          <Clock className="h-6 w-6" strokeWidth={2} />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-foreground">
          Activation en cours
        </h1>
        <p className="mt-2 text-sm text-foreground/60">
          {schoolName} est bien enregistrée, avec ses classes, le programme
          mauritanien et les modèles de messages déjà en place. Il ne reste qu&apos;à
          activer votre compte — écrivez-nous sur WhatsApp, le message est déjà
          prêt.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <a
            href={buildWhatsAppUrl(CONTACT_PHONE, message)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "primary" })}
          >
            <MessageCircle className="h-4 w-4" />
            Nous écrire sur WhatsApp
          </a>
          <SignOutButton />
        </div>

        <p className="mt-5 text-xs text-foreground/45">
          Dès l&apos;activation, reconnectez-vous : votre espace vous attend, rien
          n&apos;est perdu.
        </p>
      </div>
    </div>
  );
}
