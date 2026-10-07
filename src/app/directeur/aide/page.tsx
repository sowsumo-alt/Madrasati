import { ChevronDown, LifeBuoy, Mail, MessageCircle, Phone } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { formatPhone } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { CONTACT_EMAIL, CONTACT_PHONE } from "@/lib/contact";

/** Les questions de tous les jours, chacune avec le chemin exact dans l'application. */
const GUIDES: { title: string; steps: string[] }[] = [
  {
    title: "Inscrire un élève ou une famille",
    steps: [
      "Menu « Inscription » : choisissez « Un élève » ou « Une famille ».",
      "Remplissez l'identité, puis la fiche de paiement : montant mensuel, frais d'inscription, mois payés.",
      "Vérifiez le récapitulatif et confirmez : le reçu s'ouvre, prêt à imprimer ou à envoyer sur WhatsApp.",
    ],
  },
  {
    title: "Recopier la fiche papier d'élèves déjà inscrits",
    steps: [
      "Ouvrez la famille (menu « Familles ») ou la fiche de l'élève, puis « Fiche de paiement ».",
      "Choisissez « Forfait famille » ou « Montant par enfant », saisissez les montants tels qu'ils sont sur le papier.",
      "Cochez chaque mois payé avec sa date (les dates passées sont acceptées) : un reçu est créé par date.",
    ],
  },
  {
    title: "Encaisser un paiement plus tard",
    steps: [
      "Page de la famille : « Paiement familial », ou menu « Paiements » pour un élève.",
      "Saisissez le montant versé pour chaque mois : un seul reçu pour la famille.",
    ],
  },
  {
    title: "Annuler un reçu ou corriger sa date",
    steps: [
      "Ouvrez le reçu : « Annuler le reçu » demande un motif ; le reçu reste lisible, marqué « ANNULÉ ».",
      "« Modifier la date » met la date écrite sur la fiche papier, si le reçu a été saisi un autre jour.",
    ],
  },
  {
    title: "Imprimer les reçus",
    steps: [
      "Sur le reçu : « Imprimer ». Deux reçus tiennent sur une feuille A4 (à couper), ou un par demi-feuille.",
      "Le format se choisit dans Paramètres → Impression des reçus.",
    ],
  },
  {
    title: "Ajouter un autre directeur ou un compte en lecture seule",
    steps: [
      "Menu « Utilisateurs » → « Inviter un associé » (directeur principal uniquement).",
      "Envoyez-lui l'identifiant et le mot de passe provisoire par WhatsApp ; il choisit le sien à la première connexion.",
    ],
  },
  {
    title: "Supprimer ou archiver une famille de test",
    steps: [
      "Page de la famille → « Supprimer / archiver », puis recopiez son nom pour confirmer.",
      "« Archiver » garde tout l'historique ; « Supprimer définitivement » efface aussi ses paiements et reçus.",
    ],
  },
  {
    title: "Savoir qui a fait quoi",
    steps: ["Menu « Journal d'activité » : chaque encaissement, annulation, suppression et inscription, avec la personne et l'heure."],
  },
];

/**
 * Centre d'aide du directeur : l'assistance Madrasati (WhatsApp, appel,
 * e-mail) et les gestes de tous les jours, pas à pas.
 */
export default async function HelpPage() {
  const user = await requireRole(ROLES.DIRECTOR);
  const school = await prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } });
  const schoolName = school?.name.replace(/\s+/g, " ").trim();
  const message = `Bonjour, je suis ${user.name ?? "le directeur"}${schoolName ? ` (${schoolName})` : ""}. J'ai besoin d'aide sur Madrasati : `;
  const phone = formatPhone(CONTACT_PHONE);

  return (
    <div className="mx-auto max-w-3xl space-y-5" data-testid="help-center">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <LifeBuoy className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Centre d&apos;aide</h1>
          <p className="text-sm text-foreground/60">Une question ? L&apos;assistance Madrasati vous répond, et les gestes courants sont expliqués ici.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-surface p-5 shadow-soft" data-testid="help-contact">
        <h2 className="text-base font-semibold text-primary-900">Contacter l&apos;assistance Madrasati</h2>
        <p className="mt-1 text-sm text-foreground/70">
          Par WhatsApp ou par téléphone au <span className="font-semibold text-foreground" dir="ltr">{phone}</span>.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={buildWhatsAppUrl(CONTACT_PHONE, message)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            data-testid="help-whatsapp"
          >
            <MessageCircle className="h-4 w-4" />
            Écrire sur WhatsApp
          </a>
          <a
            href={`tel:${CONTACT_PHONE}`}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-primary-800 hover:bg-surface-muted"
          >
            <Phone className="h-4 w-4" />
            Appeler le <span dir="ltr">{phone}</span>
          </a>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-primary-800 hover:bg-surface-muted"
          >
            <Mail className="h-4 w-4" />
            {CONTACT_EMAIL}
          </a>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">Les gestes de tous les jours</h2>
        {GUIDES.map((guide) => (
          <details key={guide.title} className="group rounded-xl border border-border bg-surface shadow-soft" data-testid="help-guide">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground">
              {guide.title}
              <ChevronDown className="h-4 w-4 shrink-0 text-foreground/50 transition-transform group-open:rotate-180" />
            </summary>
            <ol className="list-decimal space-y-1.5 px-4 pb-4 ps-9 text-sm text-foreground/75">
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>
        ))}
      </section>
    </div>
  );
}
