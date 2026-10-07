import { CalendarDays, Leaf, Quote } from "lucide-react";

/** En-tête : titre et présentation, la date du jour, et la citation de la plateforme. */
export function DashboardHeader({ todayLabel }: { todayLabel: string }) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Tableau de bord{" "}
          <span className="inline-block animate-wave" aria-hidden>
            👋
          </span>
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-foreground/60">
          Voici un aperçu général de votre plateforme Madrasati. Gérez vos écoles, suivez les paiements et surveillez
          la croissance de votre réseau.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-soft">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <CalendarDays className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-foreground">Aujourd&apos;hui</span>
            <span className="block text-xs text-foreground/60" data-testid="sa-today">
              {todayLabel}
            </span>
          </span>
        </div>

        <figure className="relative hidden overflow-hidden rounded-2xl border border-border bg-surface px-5 py-3 pe-20 shadow-soft md:block">
          <Quote className="absolute start-3 top-3 h-4 w-4 text-accent-500" aria-hidden />
          <blockquote className="ps-5 text-sm font-medium italic leading-snug text-foreground/85">
            L&apos;éducation est la clé
            <br />
            d&apos;un meilleur avenir.
          </blockquote>
          <span aria-hidden className="ms-5 mt-2 block h-0.5 w-10 rounded-full bg-accent-500/70" />
          <Leaf
            aria-hidden
            className="absolute -bottom-2 end-2 h-16 w-16 rotate-12 text-emerald-500/70 dark:text-emerald-400/60"
            strokeWidth={1.25}
          />
        </figure>
      </div>
    </div>
  );
}
