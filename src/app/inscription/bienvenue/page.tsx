import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/brand/logo";
import { buildWhatsAppUrl, fillTemplate } from "@/lib/whatsapp";
import { CONTACT_PHONE } from "@/lib/contact";
import { REQUIRE_MANUAL_ACTIVATION, TRIAL_DAYS } from "@/lib/plans";

const WELCOME_MESSAGE_TEMPLATE =
  "Bonjour, je viens de créer mon école {schoolName} sur Madrasati ({city}). " +
  "Je suis {directorName}, joignable au {phone}. " +
  (REQUIRE_MANUAL_ACTIVATION
    ? "J'aimerais qu'on active mon compte."
    : "J'aimerais être accompagné pour bien démarrer.");

export default async function WelcomePage() {
  const user = await requireUser();
  // Tout compte créé passe par l'inscription d'une école : sans schoolId, la
  // session est inexploitable et on repart de la connexion.
  if (!user.schoolId) redirect("/login");

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      school: { select: { name: true, city: true, phone: true } },
    },
  });
  if (!account) redirect("/login");

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
            Votre école est enregistrée
          </h1>
          <p className="mt-2 max-w-md text-sm text-white/70">
            {account.school.name} a été créée avec ses classes, le programme
            mauritanien et les modèles de messages déjà en place.
          </p>
        </div>

        {REQUIRE_MANUAL_ACTIVATION ? (
          <div className="mt-8 rounded-2xl bg-surface p-6 shadow-2xl sm:p-8">
            {/* Plus de lien vers le tableau de bord : l'accès n'est ouvert
                qu'après activation (voir requireRole), il ne ferait que
                renvoyer l'utilisateur vers l'écran d'attente. */}
            <p className="text-sm text-foreground/60">
              Dernière étape : écrivez-nous sur WhatsApp pour faire activer
              votre compte — le message est déjà prêt avec les informations de
              votre école. Votre espace s&apos;ouvre dès l&apos;activation.
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
          </div>
        ) : (
          <div className="mt-8 rounded-2xl bg-surface p-6 shadow-2xl sm:p-8">
            {/* Validation manuelle coupée (voir REQUIRE_MANUAL_ACTIVATION) :
                l'essai a déjà démarré, le tableau de bord est ouvert. */}
            <p className="text-sm text-foreground/60">
              Votre essai gratuit de {TRIAL_DAYS} jours commence maintenant :
              ajoutez vos élèves et vos enseignants, tout le reste est prêt.
            </p>
            <Link
              href="/directeur"
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary-700 text-base font-semibold text-white transition-colors hover:bg-primary-800"
            >
              Accéder à mon tableau de bord
              <ArrowRight className="h-4.5 w-4.5 rtl:rotate-180" />
            </Link>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50"
            >
              <MessageCircle className="h-4 w-4" />
              Besoin d&apos;aide ? Écrivez-nous sur WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
