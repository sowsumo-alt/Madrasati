import Link from "next/link";
import {
  GraduationCap,
  Users,
  Wallet,
  ClipboardCheck,
  FileText,
  MessageCircle,
  CalendarDays,
  BarChart3,
  Sparkles,
  Check,
  ArrowRight,
  Wifi,
  Coins,
  BookOpen,
  ShieldCheck,
  Clock,
  Languages,
  HandCoins,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Reveal } from "@/components/marketing/reveal";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { RotatingWords } from "@/components/marketing/rotating-words";
import { PricingCalculator } from "@/components/marketing/pricing-calculator";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { CONTACT_PHONE, CONTACT_EMAIL, DEMO_MESSAGE } from "./landing-config";

const MODULES = [
  { icon: Users, title: "Élèves & parents", text: "Dossiers complets, import Excel, contact WhatsApp en un clic." },
  { icon: ClipboardCheck, title: "Présences", text: "L'appel en quelques secondes, alerte automatique aux parents absents." },
  { icon: FileText, title: "Bulletins", text: "Moyennes pondérées, mention, rang — imprimables et envoyables." },
  { icon: Wallet, title: "Finance", text: "Frais, paiements, reçus. Espèces, virement, Masrvi, Sedad." },
  { icon: CalendarDays, title: "Emploi du temps", text: "La semaine de chaque classe, prête à imprimer." },
  { icon: MessageCircle, title: "Communication", text: "Modèles de messages prêts à l'emploi, envoyés sur WhatsApp." },
  { icon: BarChart3, title: "Statistiques", text: "Présence, revenus, résultats par matière — d'un coup d'œil." },
  { icon: GraduationCap, title: "Examens & notes", text: "Planification et saisie des notes, moyenne calculée seule." },
];

const TRUST = [
  { icon: Clock, label: "Installée en une journée" },
  { icon: ShieldCheck, label: "Sans engagement" },
  { icon: Wifi, label: "Fonctionne en 3G" },
  { icon: Languages, label: "Français & arabe" },
];

const DIFFERENTIATORS = [
  {
    icon: Coins,
    title: "Tout en Ouguiya",
    text: "Les montants sont en MRU, pas en FCFA. Les modes de paiement sont ceux que vos parents utilisent vraiment : espèces, virement, Masrvi et Sedad.",
  },
  {
    icon: BookOpen,
    title: "Le programme mauritanien",
    text: "Arabe, Français, Études Islamiques, Mathématiques… les matières et leurs coefficients sont déjà en place le jour de votre installation.",
  },
  {
    icon: Wifi,
    title: "Rapide, même en 3G",
    text: "Chaque écran est conçu pour être léger. Madrasati reste utilisable quand la connexion faiblit, à Nouakchott comme à Zouerate.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp, sans configuration",
    text: "Aucun compte Meta, aucune clé technique. Un bouton ouvre WhatsApp avec le bon numéro et le message déjà écrit.",
  },
];

const ROLES = [
  {
    title: "Le directeur",
    text: "Voit et pilote tout : élèves, personnel, argent, résultats.",
    points: ["Tableau de bord complet", "Suivi des impayés", "Statistiques de l'école"],
  },
  {
    title: "L'enseignant",
    text: "Accède uniquement à ses classes, rien de plus.",
    points: ["Fait l'appel", "Saisit ses notes", "Consulte son emploi du temps"],
  },
  {
    title: "Le parent",
    text: "Suit son enfant sans avoir à se déplacer.",
    points: ["Notes et bulletin", "Absences", "Frais à payer"],
  },
];

const FAQ = [
  {
    q: "Faut-il une connexion internet permanente ?",
    a: "Une connexion est nécessaire, mais l'application est conçue pour être légère : elle reste utilisable en 3G, là où les logiciels lourds abandonnent. Les écrans les plus utilisés — appel, élèves, paiements — chargent en quelques secondes.",
  },
  {
    q: "Peut-on récupérer nos élèves déjà saisis sur Excel ?",
    a: "Oui. L'import Excel fait partie de l'installation : vous nous envoyez vos fichiers, vos élèves, classes et parents sont en place avant votre première connexion.",
  },
  {
    q: "Nos enseignants voient-ils la finance de l'école ?",
    a: "Non. Chaque rôle a son propre espace : l'enseignant ne voit que ses classes, le parent uniquement ses enfants. La finance reste réservée à la direction.",
  },
  {
    q: "L'application existe-t-elle en arabe ?",
    a: "L'interface bascule entre le français et l'anglais, et les matières portent leur nom arabe sur les bulletins. L'interface arabe complète est en préparation.",
  },
  {
    q: "Combien de temps faut-il pour démarrer ?",
    a: "Une journée suffit dans la plupart des écoles : reprise de vos données, création des comptes de vos enseignants, et une prise en main d'une heure avec votre équipe.",
  },
  {
    q: "Que se passe-t-il si nous arrêtons ?",
    a: "Vos données vous appartiennent. Vous les récupérez en Excel à tout moment, et il n'y a aucun engagement de durée.",
  },
];

/** Aperçu de l'application affiché dans le hero — dessiné en HTML, sans image. */
function AppPreview() {
  const bars = [58, 72, 66, 84, 76, 92];
  return (
    <div className="rounded-2xl border border-white/10 bg-surface p-4 shadow-2xl sm:p-5">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-accent-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-primary-300" />
        <span className="ml-2 text-xs font-medium text-foreground/50">
          Tableau de bord · École Al Amal
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-primary-50 p-3">
          <p className="text-[11px] font-medium text-primary-700/70">Élèves inscrits</p>
          <p className="mt-1 text-xl font-bold text-primary-800">1 248</p>
        </div>
        <div className="rounded-xl bg-accent-50 p-3">
          <p className="text-[11px] font-medium text-accent-700/70">Encaissé ce mois</p>
          <p className="mt-1 text-xl font-bold text-accent-700">1,2 M MRU</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border p-3">
        <p className="text-[11px] font-medium text-foreground/50">
          Présence des 6 derniers mois
        </p>
        <div className="mt-3 flex h-20 items-end gap-2">
          {bars.map((h, i) => (
            <span
              key={i}
              className="animate-bar flex-1 rounded-t bg-primary-600"
              style={{ height: `${h}%`, animationDelay: `${i * 90 + 300}ms` }}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-xl bg-surface-muted p-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700">
          <Wallet className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">
            Paiement reçu · 15 000 MRU
          </p>
          <p className="truncate text-[11px] text-foreground/50">
            Fatimetou Mint Ahmed · 6ème A
          </p>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const demoUrl = buildWhatsAppUrl(CONTACT_PHONE, DEMO_MESSAGE);

  return (
    <div className="min-h-screen bg-background">
      <MarketingNav demoUrl={demoUrl} />

      {/* — Hero */}
      <section className="relative overflow-hidden bg-primary-900 pb-16 pt-28 sm:pb-24 sm:pt-36">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            background:
              "radial-gradient(45rem 25rem at 85% -5%, #d1a542 0%, transparent 60%), radial-gradient(40rem 30rem at 5% 100%, #178a5c 0%, transparent 65%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div>
              <p className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-accent-200 ring-1 ring-white/15">
                <Sparkles className="h-3.5 w-3.5" />
                Conçu en Mauritanie, pour la Mauritanie
              </p>

              <h1
                className="animate-fade-up mt-6 text-[2.1rem] font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl"
                style={{ animationDelay: "80ms" }}
              >
                Toute votre école dans{" "}
                <RotatingWords
                  words={["une seule application", "un seul écran", "votre téléphone"]}
                  className="text-accent-300"
                />
              </h1>

              <p
                className="animate-fade-up mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg"
                style={{ animationDelay: "160ms" }}
              >
                Madrasati remplace les cahiers, les fichiers Excel et les
                groupes WhatsApp désordonnés. Élèves, notes, présences, argent
                et communication avec les parents — au même endroit.
              </p>

              <div
                className="animate-fade-up mt-8 flex flex-col gap-3 sm:flex-row"
                style={{ animationDelay: "240ms" }}
              >
                <a
                  href={demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-400 px-6 py-4 text-base font-semibold text-primary-900 transition-transform hover:scale-[1.02] hover:bg-accent-300 sm:py-3.5 sm:text-sm"
                >
                  Demander une démo gratuite
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#tarifs"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10 sm:py-3.5 sm:text-sm"
                >
                  <HandCoins className="h-4 w-4" />
                  Voir les tarifs
                </a>
              </div>

              <ul
                className="animate-fade-up mt-8 flex flex-wrap gap-x-5 gap-y-2"
                style={{ animationDelay: "320ms" }}
              >
                {TRUST.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="flex items-center gap-2 text-sm text-white/60"
                  >
                    <Icon className="h-4 w-4 text-accent-300" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="animate-fade-up relative"
              style={{ animationDelay: "360ms" }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-accent-400/20 blur-3xl"
              />
              <div className="animate-float relative lg:rotate-2">
                <AppPreview />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* — Le problème */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Diriger une école ne devrait pas prendre vos soirées.
              </h2>
              <p className="mt-4 leading-relaxed text-foreground/70">
                Les inscriptions sur un cahier. Les notes sur un fichier Excel
                qu&apos;un seul enseignant sait ouvrir. Les impayés que
                l&apos;on découvre trois mois trop tard. Les parents qui
                appellent pour savoir si leur enfant était là ce matin.
              </p>
              <p className="mt-4 leading-relaxed text-foreground/70">
                Madrasati rassemble tout cela dans un outil aussi simple à
                utiliser que WhatsApp — parce que c&apos;est souvent la seule
                application que tout le monde maîtrise déjà.
              </p>
            </Reveal>

            <div className="space-y-3">
              {[
                "Retrouver n'importe quel élève en deux secondes",
                "Savoir à tout instant qui a payé et qui doit encore",
                "Générer un bulletin complet sans calculer une seule moyenne",
                "Prévenir un parent d'une absence sans quitter l'application",
                "Voir la santé de l'école en un seul écran",
              ].map((item, i) => (
                <Reveal key={item} delay={i * 80}>
                  <p className="flex items-start gap-3 rounded-xl bg-surface-muted px-4 py-3.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                    <span className="text-sm text-foreground/80">{item}</span>
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* — Modules */}
      <section id="modules" className="scroll-mt-20 border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Tout ce dont votre école a besoin
            </h2>
            <p className="mt-3 max-w-2xl text-foreground/60">
              Chaque module est pensé pour être compris sans formation.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={(i % 4) * 90} className="h-full">
                <div className="group h-full rounded-xl border border-border bg-surface p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700 transition-colors group-hover:bg-primary-700 group-hover:text-white">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground/60">
                    {text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* — Ce qui rend Madrasati différent */}
      <section id="mauritanie" className="scroll-mt-20 border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Fait pour la Mauritanie — et rien d&apos;autre
            </h2>
            <p className="mt-3 max-w-2xl text-foreground/60">
              Les logiciels venus d&apos;ailleurs demandent d&apos;adapter votre
              école à l&apos;outil. Ici, c&apos;est l&apos;inverse.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:gap-8">
            {DIFFERENTIATORS.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={(i % 2) * 100}>
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {title}
                    </h3>
                    <p className="mt-1.5 leading-relaxed text-foreground/65">
                      {text}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* — Trois espaces */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Chacun voit ce qui le concerne
            </h2>
            <p className="mt-3 max-w-2xl text-foreground/60">
              Un enseignant ne voit jamais la finance de l&apos;école. Un parent
              ne voit que ses propres enfants.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {ROLES.map((role, i) => (
              <Reveal key={role.title} delay={i * 100} className="h-full">
                <div className="h-full rounded-2xl border border-border bg-surface p-6 shadow-sm">
                  <h3 className="text-base font-semibold text-foreground">
                    {role.title}
                  </h3>
                  <p className="mt-2 text-sm text-foreground/60">{role.text}</p>
                  <ul className="mt-4 space-y-2">
                    {role.points.map((p) => (
                      <li
                        key={p}
                        className="flex items-center gap-2 text-sm text-foreground/75"
                      >
                        <Check className="h-4 w-4 shrink-0 text-primary-600" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* — Tarifs */}
      <section id="tarifs" className="scroll-mt-20 border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal>
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Un tarif à la taille de votre école
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-foreground/60">
                Déplacez le curseur sur votre nombre d&apos;élèves : vous voyez
                immédiatement ce que vous paierez. Plus l&apos;école est grande,
                moins l&apos;élève coûte.
              </p>
            </div>
          </Reveal>

          <div className="mt-10">
            <PricingCalculator phone={CONTACT_PHONE} />
          </div>
        </div>
      </section>

      {/* — Questions fréquentes */}
      <section id="questions" className="scroll-mt-20 border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Questions fréquentes
            </h2>
          </Reveal>

          <div className="mt-8 space-y-3">
            {FAQ.map((item, i) => (
              <Reveal key={item.q} delay={i * 60}>
                <details className="group rounded-xl border border-border bg-surface px-5 py-4 shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-foreground marker:content-none">
                    {item.q}
                    <span className="shrink-0 text-xl leading-none text-primary-600 transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/65">
                    {item.a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* — Appel à l'action final */}
      <section className="relative overflow-hidden bg-primary-900">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            background:
              "radial-gradient(40rem 20rem at 50% 0%, #d1a542 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
              Voyez Madrasati sur votre propre école
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-white/70">
              Nous vous montrons l&apos;application avec vos classes et vos
              élèves, et nous vous accompagnons à l&apos;installation. Sans
              engagement.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent-400 px-7 py-4 text-base font-semibold text-primary-900 transition-transform hover:scale-[1.02] hover:bg-accent-300 sm:w-auto sm:py-3.5 sm:text-sm"
              >
                <MessageCircle className="h-4 w-4" />
                Nous écrire sur WhatsApp
              </a>
              <a
                href={`tel:${CONTACT_PHONE}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto sm:py-3.5 sm:text-sm"
              >
                {CONTACT_PHONE}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* — Pied de page */}
      <footer className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
            <div className="max-w-xs">
              <span className="flex items-center gap-2 text-primary-800">
                <Logo className="h-8 w-8" />
                <span className="text-lg font-bold">Madrasati</span>
              </span>
              <p className="mt-3 text-sm leading-relaxed text-foreground/55">
                La gestion scolaire pensée pour les écoles mauritaniennes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 text-sm sm:gap-14">
              <div>
                <p className="font-semibold text-foreground">Le produit</p>
                <div className="mt-3 flex flex-col gap-2 text-foreground/60">
                  <a href="#modules" className="hover:text-foreground">
                    Fonctionnalités
                  </a>
                  <a href="#tarifs" className="hover:text-foreground">
                    Tarifs
                  </a>
                  <a href="#questions" className="hover:text-foreground">
                    Questions
                  </a>
                  <Link href="/login" className="hover:text-foreground">
                    Connexion
                  </Link>
                </div>
              </div>
              <div>
                <p className="font-semibold text-foreground">Nous joindre</p>
                <div className="mt-3 flex flex-col gap-2 text-foreground/60">
                  <a href={`tel:${CONTACT_PHONE}`} className="hover:text-foreground">
                    {CONTACT_PHONE}
                  </a>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground">
                    {CONTACT_EMAIL}
                  </a>
                  <a
                    href={demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground"
                  >
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-10 border-t border-border pt-6 text-xs text-foreground/40">
            © {new Date().getFullYear()} Madrasati — Nouakchott, Mauritanie
          </p>
        </div>
      </footer>
    </div>
  );
}
