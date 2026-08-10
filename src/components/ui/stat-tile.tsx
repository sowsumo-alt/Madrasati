import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatTileProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "primary" | "accent" | "warning" | "neutral";
}

const toneStyles: Record<NonNullable<StatTileProps["tone"]>, string> = {
  primary: "bg-primary-50 text-primary-700",
  accent: "bg-accent-50 text-accent-700",
  warning: "bg-accent-50 text-warning",
  neutral: "bg-surface-muted text-foreground/70",
};

export function StatTile({ label, value, icon: Icon, tone = "neutral" }: StatTileProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground/60">{label}</span>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", toneStyles[tone])}>
          <Icon className="h-4.5 w-4.5" strokeWidth={2} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
    </div>
  );
}
