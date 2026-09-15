import { AlertTriangle } from "lucide-react";
import type { ClassTone } from "@/lib/classes-list";
import { cn } from "@/lib/utils";

const PILL_TONES: Record<ClassTone, string> = {
  green: "bg-primary-100/80 text-primary-700",
  blue: "bg-sky-100 text-sky-800",
  amber: "bg-amber-100 text-amber-800",
  violet: "bg-violet-100 text-violet-700",
};

/** Nom d'une classe dans une pastille de couleur (voir classTone). */
export function ClassPill({
  name,
  tone,
  className,
}: {
  name: string;
  tone: ClassTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-9 min-w-[3.25rem] shrink-0 items-center justify-center rounded-full px-3 text-base font-bold",
        PILL_TONES[tone],
        className,
      )}
    >
      {name}
    </span>
  );
}

/** Pastille « Incomplète » : l'infobulle dit ce qui manque. */
export function IncompleteBadge({ label, title }: { label: string; title: string }) {
  return (
    <span
      title={title}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100/80 px-2.5 py-1 text-xs font-medium text-amber-700"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
