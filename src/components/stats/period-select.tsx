"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n/language-provider";

export type PeriodMonths = 6 | 12;

/** « 6 derniers mois » ou « 12 derniers mois » pour un graphique mensuel. */
export function PeriodSelect({
  value,
  onChange,
}: {
  value: PeriodMonths;
  onChange: (months: PeriodMonths) => void;
}) {
  const { t } = useLanguage();
  const label = (months: PeriodMonths) =>
    months === 6 ? t("stats.last6Months") : t("stats.last12Months");

  return (
    <Select
      value={String(value)}
      // Radix signale parfois une valeur vide : ignorée.
      onValueChange={(v) => v && onChange(Number(v) === 6 ? 6 : 12)}
    >
      <SelectTrigger className="h-9 w-auto gap-2 text-xs" aria-label={t("stats.period")}>
        <SelectValue>{label(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-[10rem]">
        <SelectItem value="6">{label(6)}</SelectItem>
        <SelectItem value="12">{label(12)}</SelectItem>
      </SelectContent>
    </Select>
  );
}
