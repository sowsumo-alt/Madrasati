"use client";

import { CalendarDays, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import {
  PAYMENT_STATUS_FILTERS,
  type FeeListFilters,
  type PaymentStatusFilter,
} from "@/lib/payments-list";
import { formatDate } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { FEE_STATUS_KEYS } from "./fee-status-badge";

// Un libellé long reste sur une ligne, tronqué ; Radix ignore la classe posée
// sur SelectValue, la valeur est donc visée depuis le bouton.
const trigger = "gap-2 text-start [&>span:first-child]:min-w-0 [&>span:first-child]:truncate";

/**
 * Recherche et filtres de la liste des paiements. La période et le mode de
 * paiement vivent dans un volet qui se déplie sous la barre — ouvert par le
 * bouton de période comme par « Filtres » — plutôt que dans une fenêtre
 * flottante, pour rester utilisable au doigt sur téléphone.
 */
export function PaymentsToolbar({
  filters,
  onChange,
  classes,
  panelOpen,
  onPanelOpenChange,
}: {
  filters: FeeListFilters;
  onChange: (patch: Partial<FeeListFilters>) => void;
  classes: { id: string; name: string }[];
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();

  const statusLabel = (s: PaymentStatusFilter) =>
    s === "ALL"
      ? t("finance.allStatuses")
      : s === "UNPAID"
        ? t("finance.filterUnsettled")
        : t(FEE_STATUS_KEYS[s]);
  const methodLabel = (m: string) =>
    m === "ALL"
      ? t("finance.allMethods")
      : m === "NONE"
        ? t("finance.noPaymentYet")
        : t(`finance.methodShort.${m}` as TranslationKey);

  const periodLabel =
    filters.from && filters.to
      ? `${formatDate(filters.from)} – ${formatDate(filters.to)}`
      : filters.from
        ? t("finance.periodFrom").replace("{date}", formatDate(filters.from))
        : filters.to
          ? t("finance.periodTo").replace("{date}", formatDate(filters.to))
          : t("finance.periodAll");
  const advancedCount = (filters.from || filters.to ? 1 : 0) + (filters.method !== "ALL" ? 1 : 0);

  return (
    <div className="rounded-2xl border border-border/80 bg-surface p-3 shadow-soft">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            value={filters.query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder={t("finance.searchPlaceholderFull")}
            aria-label={t("common.search")}
            className="ps-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:flex xl:shrink-0">
          <Select value={filters.classId} onValueChange={(v) => onChange({ classId: v })}>
            <SelectTrigger className={cn(trigger, "xl:w-40")} aria-label={t("students.allClasses")}>
              <SelectValue>
                {filters.classId === "ALL"
                  ? t("students.allClasses")
                  : (classes.find((c) => c.id === filters.classId)?.name ?? t("students.allClasses"))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("students.allClasses")}</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.status}
            onValueChange={(v) => onChange({ status: v as PaymentStatusFilter })}
          >
            <SelectTrigger className={cn(trigger, "xl:w-40")} aria-label={t("finance.allStatuses")}>
              <SelectValue>{statusLabel(filters.status)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            type="button"
            onClick={() => onPanelOpenChange(!panelOpen)}
            aria-expanded={panelOpen}
            className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-foreground transition-colors hover:bg-surface-muted/60 xl:w-60"
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-foreground/45" />
            <span className="min-w-0 flex-1 truncate text-start">{periodLabel}</span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 text-foreground/40 transition-transform", panelOpen && "rotate-180")}
            />
          </button>

          <button
            type="button"
            onClick={() => onPanelOpenChange(!panelOpen)}
            aria-expanded={panelOpen}
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors",
              advancedCount > 0
                ? "border-primary-300 bg-primary-50 text-primary-800"
                : "border-border text-foreground/75 hover:bg-surface-muted",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {t("finance.filters")}
            {advancedCount > 0 && (
              <span className="rounded-full bg-primary-700 px-1.5 text-[11px] font-semibold leading-5 text-white">
                {advancedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {panelOpen && (
        <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="payments-from">{t("finance.periodStart")}</Label>
            <DateInput
              id="payments-from"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => onChange({ from: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payments-to">{t("finance.periodEnd")}</Label>
            <DateInput
              id="payments-to"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => onChange({ to: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payments-method">{t("finance.method")}</Label>
            <Select value={filters.method} onValueChange={(v) => onChange({ method: v })}>
              <SelectTrigger id="payments-method" className={trigger}>
                <SelectValue>{methodLabel(filters.method)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {["ALL", "NONE", ...PAYMENT_METHODS].map((m) => (
                  <SelectItem key={m} value={m}>
                    {methodLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange({ from: "", to: "", method: "ALL" })}
            disabled={advancedCount === 0}
          >
            <X className="h-4 w-4" />
            {t("finance.resetFilters")}
          </Button>
        </div>
      )}
    </div>
  );
}
