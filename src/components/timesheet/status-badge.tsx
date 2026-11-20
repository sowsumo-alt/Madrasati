import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_TONE, type SessionStatus } from "@/lib/timesheet";

const TONE_CLASS: Record<(typeof STATUS_TONE)[SessionStatus], string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  orange: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  gray: "bg-slate-100 text-slate-600 ring-slate-200",
};

/** Statut d'une séance : vert présent, orange retard, rouge absent. */
export function SessionStatusBadge({
  status,
  lateMinutes = 0,
  replacement,
  className,
}: {
  status: SessionStatus;
  lateMinutes?: number;
  replacement?: string | null;
  className?: string;
}) {
  const label =
    status === "LATE" && lateMinutes > 0
      ? `Retard · ${lateMinutes} min`
      : status === "REPLACED" && replacement
        ? `Remplacé · ${replacement}`
        : STATUS_LABELS[status];
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", TONE_CLASS[STATUS_TONE[status]], className)}
      data-testid="session-status"
      data-status={status}
    >
      {label}
    </span>
  );
}
