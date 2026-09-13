import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Carte d'une section du tableau de bord : titre, lien « Voir tout » éventuel,
 * puis contenu. Toutes les sections partagent ainsi le même en-tête, les mêmes
 * marges et la même ombre douce.
 */
export function SectionCard({
  title,
  icon: Icon,
  href,
  linkLabel,
  headerExtra,
  className,
  bodyClassName,
  delay = 0,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  href?: string;
  linkLabel?: string;
  /** Contrôle placé à droite du titre (choix de période, de regroupement…). */
  headerExtra?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Décalage d'apparition en ms, pour faire entrer la page en cascade. */
  delay?: number;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "animate-page-in flex min-w-0 flex-col rounded-2xl border border-border/80 bg-surface shadow-soft",
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold text-foreground">
          {Icon && <Icon className="h-5 w-5 shrink-0 text-primary-600" strokeWidth={2} />}
          {/* Retour à la ligne plutôt que troncature : sur téléphone, le choix
              de période à côté ne laissait lire que « Évolution de l… ». */}
          <span className="min-w-0 leading-snug">{title}</span>
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {headerExtra}
          {href && linkLabel && (
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 transition-colors hover:text-primary-800"
            >
              {linkLabel}
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
          )}
        </div>
      </div>
      <div className={cn("min-w-0 flex-1 px-5 pb-5", bodyClassName)}>{children}</div>
    </section>
  );
}
