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
} from "lucide-react";
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

export function LandingPage() {
  const demoUrl = buildWhatsAppUrl(CONTACT_PHONE, DEMO_MESSAGE);

  return (
    <div className="min-h-screen bg-background">
      {/* — Barre de navigation */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="flex items-center gap-2 text-primary-800">
            <GraduationCap className="h-6 w-6" strokeWidth={2} />
            <span className="text-lg font-semibold tracking-tight">Madrasati</span>
          </span>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
            >
              Connexion
            </Link>
            <a
              href={demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-800"
            >
              Demander une démo
            </a>
          </div>
        </div>
      </header>

      {/* — Hero */}
      <section className="relative overflow-hidden border-b border-border bg-primary-900">
        {/* Voile doré discret, en dégradé — évoque le sable sans image à charger. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background:
              "radial-gradient(60rem 30rem at 80% -10%, #d1a542 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-accent-200">
            <Sparkles className="h-3.5 w-3.5" />
            Conçu en Mauritanie, pour la Mauritanie
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
            Toute votre école dans une seule application.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/70">
            Madrasati remplace les cahiers, les fichiers Excel et les groupes
            WhatsApp désordonnés. Élèves, notes, présences, argent et
            communication avec les parents — au même endroit, en français comme
            en anglais.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-400 px-6 py-3 text-sm font-semibold text-primary-900 transition-colors hover:bg-accent-300"
            >
              Demander une démo gratuite
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              J&apos;ai déjà un compte
            </Link>
          </div>
          <p className="mt-6 text-sm text-white/50">
            Nouakchott · Nouadhibou · Kiffa · Rosso · Zouerate · Kaédi
          </p>
        </div>
      </section>

      {/* — Le problème */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
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
            </div>
            <ul className="space-y-3">
              {[
                "Retrouver n'importe quel élève en deux secondes",
                "Savoir à tout instant qui a payé et qui doit encore",
                "Générer un bulletin complet sans calculer une seule moyenne",
                "Prévenir un parent d'une absence sans quitter l'application",
                "Voir la santé de l'école en un seul écran",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-lg bg-surface-muted px-4 py-3"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                  <span className="text-sm text-foreground/80">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* — Modules */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Tout ce dont votre école a besoin
          </h2>
          <p className="mt-3 max-w-2xl text-foreground/60">
            Chaque module est pensé pour être compris sans formation.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-xl border border-border bg-surface p-5 shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/60">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* — Ce qui rend Madrasati différent */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Fait pour la Mauritanie — et rien d&apos;autre
          </h2>
          <p className="mt-3 max-w-2xl text-foreground/60">
            Les logiciels venus d&apos;ailleurs demandent d&apos;adapter votre
            école à l&apos;outil. Ici, c&apos;est l&apos;inverse.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {DIFFERENTIATORS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{title}</h3>
                  <p className="mt-1.5 leading-relaxed text-foreground/65">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* — Trois espaces */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Chacun voit ce qui le concerne
          </h2>
          <p className="mt-3 max-w-2xl text-foreground/60">
            Un enseignant ne voit jamais la finance de l&apos;école. Un parent
            ne voit que ses propres enfants.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {ROLES.map((role) => (
              <div
                key={role.title}
                className="rounded-xl border border-border bg-surface p-6 shadow-sm"
              >
                <h3 className="text-base font-semibold text-foreground">
                  {role.title}
                </h3>
                <p className="mt-2 text-sm text-foreground/60">{role.text}</p>
                <ul className="mt-4 space-y-2">
                  {role.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm text-foreground/75">
                      <Check className="h-4 w-4 shrink-0 text-primary-600" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* — Appel à l'action final */}
      <section className="bg-primary-900">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            Voyez Madrasati sur votre propre école
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-white/70">
            Nous vous montrons l&apos;application avec vos classes et vos
            élèves, et nous vous accompagnons à l&apos;installation. Sans
            engagement.
          </p>
          <a
            href={demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-accent-400 px-7 py-3.5 text-sm font-semibold text-primary-900 transition-colors hover:bg-accent-300"
          >
            <MessageCircle className="h-4 w-4" />
            Nous écrire sur WhatsApp
          </a>
        </div>
      </section>

      {/* — Pied de page */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex items-center gap-2 text-primary-800">
            <GraduationCap className="h-5 w-5" strokeWidth={2} />
            <span className="font-semibold">Madrasati</span>
          </span>
          <div className="flex flex-col gap-1 text-sm text-foreground/60 sm:flex-row sm:gap-6">
            <a href={`tel:${CONTACT_PHONE}`} className="hover:text-foreground">
              {CONTACT_PHONE}
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground">
              {CONTACT_EMAIL}
            </a>
            <Link href="/login" className="hover:text-foreground">
              Connexion
            </Link>
          </div>
          <p className="text-xs text-foreground/40">
            © {new Date().getFullYear()} Madrasati — Nouakchott, Mauritanie
          </p>
        </div>
      </footer>
    </div>
  );
}
