import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Tone = "primary" | "accent" | "warning" | "info" | "violet" | "neutral";

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
}

const toneStyles: Record<Tone, string> = {
  primary: "bg-primary-50 text-primary-600",
  accent: "bg-accent-50 text-accent-600",
  warning: "bg-amber-50 text-amber-600",
  info: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
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
    "flex items-center gap-3.5 rounded-xl border border-border bg-surface p-4 shadow-sm",
    href && "transition-colors hover:border-primary-200 hover:bg-primary-50/40",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}
