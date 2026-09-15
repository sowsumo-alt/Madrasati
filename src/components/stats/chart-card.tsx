import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Carte d'un graphique des statistiques : icône, titre et, à droite, son réglage (période…). */
export function ChartCard({
  icon: Icon,
  title,
  action,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    // min-w-0 : un graphique SVG a pour largeur minimale celle de son viewBox,
    // qui élargissait la carte — et la page — sur téléphone.
    <section className={cn("min-w-0 rounded-2xl border border-border/80 bg-surface p-5 shadow-soft", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2.5 text-base font-semibold text-foreground">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Icon className="h-4 w-4" />
          </span>
          <span className="truncate">{title}</span>
        </h2>
        {action && <div className="no-print shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}
