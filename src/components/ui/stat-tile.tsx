import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// Trois couleurs seulement, chacune avec un sens fixe dans toute
// l'application : primary pour les effectifs et l'activité, accent (or)
// réservé à l'argent, warning aux alertes. neutral pour le reste — pas de
// couleur ajoutée « pour varier ».
type Tone = "primary" | "accent" | "warning" | "neutral";

interface StatTileProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: Tone;
  /** Ligne d'appoint sous la valeur : évolution, unité, précision. */
  hint?: string;
  /** Colore la ligne d'appoint en vert (progression) plutôt qu'en gris. */
  hintPositive?: boolean;
  href?: string;
  /** Décalage d'apparition en ms, pour faire entrer une grille en cascade. */
  delay?: number;
}

const toneStyles: Record<Tone, string> = {
  primary: "bg-primary-50 text-primary-600",
  accent: "bg-accent-50 text-accent-600",
  warning: "bg-amber-50 text-amber-600",
  neutral: "bg-surface-muted text-foreground/60",
};

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  hint,
  hintPositive = false,
  href,
  delay = 0,
}: StatTileProps) {
  const content = (
    <>
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
          toneStyles[tone],
        )}
      >
        <Icon className="h-5.5 w-5.5" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-foreground/55">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
          {value}
        </p>
        {hint && (
          <p
            className={cn(
              "mt-0.5 truncate text-xs",
              hintPositive ? "font-medium text-primary-600" : "text-foreground/45",
            )}
          >
            {hint}
          </p>
        )}
      </div>
    </>
  );

  const className = cn(
    "animate-page-in flex items-center gap-3.5 rounded-xl border border-border bg-surface p-4 shadow-sm transition-all duration-200",
    href && "hover:-translate-y-0.5 hover:border-primary-200 hover:bg-primary-50/40 hover:shadow-md",
  );
  const style = { animationDelay: `${delay}ms` };

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {content}
      </Link>
    );
  }
  return (
    <div className={className} style={style}>
      {content}
    </div>
  );
}
