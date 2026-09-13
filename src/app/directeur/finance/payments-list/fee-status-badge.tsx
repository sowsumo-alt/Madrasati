"use client";

import type { FeeDisplayStatus } from "@/lib/fee-status";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";

export const FEE_STATUS_KEYS: Record<FeeDisplayStatus, TranslationKey> = {
  PAID: "finance.status.PAID",
  PARTIAL: "finance.status.PARTIAL",
  OVERDUE: "finance.status.OVERDUE",
  PENDING: "finance.status.PENDING",
};

// Les couleurs de la maquette : vert payé, orange en cours, rouge impayé. Le
// libellé reste toujours écrit — la couleur seule ne porte jamais le statut.
const STYLE: Record<FeeDisplayStatus, string> = {
  PAID: "bg-emerald-50 text-emerald-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  OVERDUE: "bg-red-50 text-red-700",
  PENDING: "bg-slate-100 text-slate-600",
};

export function FeeStatusBadge({ status }: { status: FeeDisplayStatus }) {
  const { t } = useLanguage();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        STYLE[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {t(FEE_STATUS_KEYS[status])}
    </span>
  );
}

/**
 * Ancienneté d'un retard : « 3 jours de retard », « 2 mois de retard ».
 * Une échéance d'octobre dernier et une d'avant-hier portent le même badge ;
 * c'est cette précision qui dit laquelle relancer en premier.
 */
export function overdueText(days: number, t: (key: TranslationKey) => string): string {
  if (days <= 0) return "";
  if (days === 1) return t("finance.overdueOneDay");
  if (days < 31) return t("finance.overdueDays").replace("{n}", String(days));
  const months = Math.floor(days / 30);
  return months === 1
    ? t("finance.overdueOneMonth")
    : t("finance.overdueMonths").replace("{n}", String(months));
}
