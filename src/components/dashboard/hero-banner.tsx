import { CalendarDays, Clock, School } from "lucide-react";
import { LiveClock } from "./live-clock";

/**
 * Bandeau d'accueil : nom de l'école, salutation, date et heure du jour, et une
 * citation. Sans photo, par choix : un dégradé vert de la marque, un semis de
 * points et une école en filigrane — rien de plus à télécharger sur une
 * connexion lente.
 */
export function HeroBanner({
  schoolName,
  greeting,
  subtitle,
  dateLabel,
  nowIso,
  quote,
}: {
  schoolName: string;
  greeting: string;
  subtitle: string;
  dateLabel: string;
  /** Heure du rendu serveur, point de départ de l'horloge. */
  nowIso: string;
  quote: string;
}) {
  return (
    <section className="animate-page-in relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 text-white shadow-soft">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 end-[-4rem] h-72 w-72 rounded-full bg-primary-400/30 blur-3xl" />
        <div className="absolute -bottom-28 end-1/3 h-56 w-56 rounded-full bg-accent-400/20 blur-3xl" />
        <svg className="absolute inset-y-0 end-0 h-full w-2/3 text-white/10 [mask-image:linear-gradient(to_left,black,transparent)] rtl:[mask-image:linear-gradient(to_right,black,transparent)]">
          <defs>
            <pattern id="hero-dots" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.4" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-dots)" />
        </svg>
        <School className="absolute -bottom-8 end-4 h-48 w-48 text-white/[0.07]" strokeWidth={1} />
      </div>

      <div className="flex flex-col gap-6 px-6 py-7 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-accent-300">{schoolName}</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting}{" "}
            <span className="inline-block animate-wave" aria-hidden>
              👋
            </span>
          </h1>
          <p className="mt-1.5 text-sm text-white/80 sm:text-base">{subtitle}</p>
          <div className="mt-5 flex flex-wrap gap-2.5 text-sm">
            <span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 ring-1 ring-white/15">
              <CalendarDays className="h-4 w-4 text-accent-300" />
              {dateLabel}
            </span>
            <span
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 ring-1 ring-white/15"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              <Clock className="h-4 w-4 text-accent-300" />
              <LiveClock initialIso={nowIso} />
            </span>
          </div>
        </div>

        <figure className="hidden max-w-[17rem] shrink-0 md:block">
          <blockquote className="text-lg font-medium italic leading-snug text-white/90">
            {quote}
          </blockquote>
          <span aria-hidden className="mt-3 block h-0.5 w-10 rounded-full bg-accent-300" />
        </figure>
      </div>
      <div aria-hidden className="h-1 bg-gradient-to-r from-accent-600 via-accent-300 to-accent-600" />
    </section>
  );
}
