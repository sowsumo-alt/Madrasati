import { ShieldAlert, MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/brand/logo";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { CONTACT_PHONE } from "@/lib/contact";
import { buttonVariants } from "@/components/ui/button";
import { SignOutButton } from "./sign-out-button";

export default async function SuspendedAccountPage() {
  const user = await requireUser();
  const school = user.schoolId
    ? await prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } })
    : null;

  const message = `Bonjour, l'accès de l'école ${school?.name ?? ""} sur Madrasati est suspendu. Je souhaite régulariser mon abonnement.`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <Logo className="mx-auto h-12 w-12" />
        <span className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-danger">
          <ShieldAlert className="h-6 w-6" strokeWidth={2} />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-foreground">
          Accès suspendu
        </h1>
        <p className="mt-2 text-sm text-foreground/60">
          L&apos;abonnement Madrasati de {school?.name ?? "votre école"} est actuellement
          suspendu. Contactez-nous sur WhatsApp pour régulariser votre situation — l&apos;accès
          est réactivé dès réception du paiement.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <a
            href={buildWhatsAppUrl(CONTACT_PHONE, message)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "primary" })}
          >
            <MessageCircle className="h-4 w-4" />
            Contacter Madrasati sur WhatsApp
          </a>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
