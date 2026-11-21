import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  ["jour", "/directeur/pointage", "Aujourd'hui"],
  ["paie", "/directeur/pointage/paie", "Paie du mois"],
  ["jours", "/directeur/pointage/jours", "Jours non travaillés"],
  ["fiches", "/directeur/pointage/fiches", "Fiches PDF"],
] as const;

/** En-tête commun du module Pointage : titre et onglets. */
export function TimesheetHeader({ current, title, subtitle }: { current: (typeof TABS)[number][0]; title: string; subtitle: string }) {
  return (
    <div className="no-print space-y-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-foreground/60">{subtitle}</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1 text-sm" aria-label="Pointage">
        {TABS.map(([key, href, label]) => (
          <Link
            key={key}
            href={href}
            aria-current={current === key ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors",
              current === key ? "bg-primary-700 text-white" : "text-foreground/70 hover:bg-surface-muted",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Le module n'est pas activé pour l'école : le directeur l'active dans Paramètres. */
export function TimesheetDisabled() {
  return (
    <div className="rounded-2xl border border-border bg-surface px-6 py-16 text-center" data-testid="timesheet-disabled">
      <h1 className="text-lg font-semibold text-foreground">Pointage &amp; paie des enseignants</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-foreground/60">
        Ce module n&apos;est pas activé pour votre école. Il remplace la fiche de pointage papier : les enseignants pointent depuis
        leur téléphone, la paie se calcule seule.
      </p>
      <Link href="/directeur/parametres#pointage" className="mt-4 inline-block font-medium text-primary-700 underline-offset-2 hover:underline">
        L&apos;activer dans Paramètres
      </Link>
    </div>
  );
}
