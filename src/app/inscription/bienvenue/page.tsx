import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/brand/logo";
import { buildWhatsAppUrl, fillTemplate } from "@/lib/whatsapp";
import { CONTACT_PHONE } from "@/app/(marketing)/landing-config";

const WELCOME_MESSAGE_TEMPLATE =
  "Bonjour, je viens de créer mon école {schoolName} sur Madrasati ({city}). " +
  "Je suis {directorName}, joignable au {phone}. J'aimerais qu'on active mon compte.";

export default async function WelcomePage() {
  const user = await requireUser();
  if (!user.schoolId) redirect("/inscription/ecole");

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      school: { select: { name: true, city: true, phone: true } },
    },
  });
  if (!account) redirect("/inscription/ecole");

  const message = fillTemplate(WELCOME_MESSAGE_TEMPLATE, {
    schoolName: account.school.name,
    city: account.school.city ?? "",
    directorName: account.name,
    phone: account.school.phone ?? "",
  });
  const whatsappUrl = buildWhatsAppUrl(CONTACT_PHONE, message);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-primary-400 px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 85% 15%, white 0, transparent 35%), radial-gradient(circle at 15% 85%, white 0, transparent 40%)",
        }}
      />

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Logo className="h-16 w-16" />
          <span className="mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-white">
            <CheckCircle2 className="h-7 w-7" strokeWidth={2} />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Votre école est prête
          </h1>
          <p className="mt-2 max-w-md text-sm text-white/70">
            {account.school.name} a été créée avec le programme mauritanien et
            les modèles de messages déjà en place.
          </p>
        </div>

        <div className="mt-8 rounded-2xl bg-surface p-6 shadow-2xl sm:p-8">
          <p className="text-sm text-foreground/60">
            Pour activer votre compte, écrivez-nous sur WhatsApp — le message
            est déjà prêt avec les informations de votre école.
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary-700 text-base font-semibold text-white transition-colors hover:bg-primary-800"
          >
            <MessageCircle className="h-4.5 w-4.5" />
            Nous écrire sur WhatsApp
          </a>
          <Link
            href="/"
            className="mt-4 flex h-12 w-full items-center justify-center rounded-lg border border-border text-sm font-medium text-foreground/70 transition-colors hover:bg-surface-muted"
          >
            Aller à mon tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}
