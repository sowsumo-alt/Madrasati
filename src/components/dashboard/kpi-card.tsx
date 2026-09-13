import Link from "next/link";
import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/charts/sparkline";
import { ProgressRing } from "@/components/charts/progress-ring";

export type KpiTone = "emerald" | "blue" | "amber" | "rose" | "violet" | "cyan" | "pink";

// Une teinte par indicateur, comme sur la maquette : l'œil retrouve une tuile à
// sa couleur d'un jour sur l'autre. La valeur reste toujours écrite en toutes
// lettres — la couleur n'en porte jamais seule le sens.
const TONES: Record<KpiTone, { badge: string; line: string }> = {
  emerald: { badge: "bg-emerald-50 text-emerald-600 ring-emerald-50/60", line: "#10b981" },
  blue: { badge: "bg-blue-50 text-blue-600 ring-blue-50/60", line: "#3b82f6" },
  amber: { badge: "bg-amber-50 text-amber-600 ring-amber-50/60", line: "#f59e0b" },
  rose: { badge: "bg-rose-50 text-rose-600 ring-rose-50/60", line: "#f43f5e" },
  violet: { badge: "bg-violet-50 text-violet-600 ring-violet-50/60", line: "#8b5cf6" },
  cyan: { badge: "bg-cyan-50 text-cyan-600 ring-cyan-50/60", line: "#06b6d4" },
  pink: { badge: "bg-pink-50 text-pink-600 ring-pink-50/60", line: "#ec4899" },
};

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: KpiTone;
  /** Ligne d'appoint sous la valeur : évolution, unité, précision. */
  hint?: string;
  /** Progression : flèche montante et texte en vert. */
  hintPositive?: boolean;
  /** Recul : flèche descendante et texte en rouge. */
  hintNegative?: boolean;
  /** Mini-courbe d'évolution, du plus ancien au plus récent. */
  trend?: number[];
  /** Pourcentage affiché en anneau, à la place de la mini-courbe. */
  ring?: number;
  href?: string;
  /** Décalage d'apparition en ms, pour faire entrer la grille en cascade. */
  delay?: number;
}

/**
 * Tuile d'indicateur du tableau de bord. Elle s'adapte à sa propre largeur
 * (requêtes de conteneur) et non à celle de l'écran : la même tuile est large
 * sur une rangée de deux et étroite sur une rangée de quatre.
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
  hintPositive = false,
  hintNegative = false,
  trend,
  ring,
  href,
  delay = 0,
}: KpiCardProps) {
  const style = TONES[tone];

  const body = (
    <div className="flex items-center gap-3 @min-[15rem]:gap-4">
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-4 @min-[15rem]:h-14 @min-[15rem]:w-14",
          style.badge,
        )}
      >
        <Icon className="h-5 w-5 @min-[15rem]:h-6 @min-[15rem]:w-6" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-foreground/60">{label}</p>
        <p
          className="mt-0.5 truncate text-xl font-bold tracking-tight text-foreground @min-[15rem]:text-2xl"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </p>
        <div className="mt-1 flex items-end justify-between gap-2">
          {hint && (
            <p
              className={cn(
                "flex min-w-0 items-center gap-1 text-xs",
                hintPositive
                  ? "font-medium text-emerald-600"
                  : hintNegative
                    ? "font-medium text-red-600"
                    : "text-foreground/45",
              )}
            >
              {hintPositive && <TrendingUp className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />}
              {!hintPositive && hintNegative && (
                <TrendingDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
              )}
              <span className="truncate">{hint}</span>
            </p>
          )}
          {ring == null && trend && trend.length > 1 && (
            <Sparkline
              values={trend}
              color={style.line}
              className="hidden h-7 w-16 shrink-0 @min-[13rem]:block"
            />
          )}
        </div>
      </div>
      {ring != null && (
        <span className="hidden shrink-0 @min-[13rem]:block">
          <ProgressRing value={ring} color="#10b981" size={52} />
        </span>
      )}
    </div>
  );

  const className = cn(
    "@container animate-page-in block rounded-2xl border border-border/80 bg-surface p-4 shadow-soft transition-all duration-200",
    href && "hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md",
  );
  const animation = { animationDelay: `${delay}ms` };

  if (href) {
    return (
      <Link href={href} className={className} style={animation}>
        {body}
      </Link>
    );
  }
  return (
    <div className={className} style={animation}>
      {body}
    </div>
  );
}
