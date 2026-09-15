"use client";

import { Banknote, Receipt, ReceiptText, Wallet } from "lucide-react";
import { FormSection } from "@/components/forms/form-section";
import { PaymentMethodPicker } from "@/components/payments/payment-method-picker";
import { StudentAvatar } from "@/components/students/student-avatar";
import { familyTotal, parseAmount } from "@/lib/family";
import { formatMRU } from "@/lib/format";
import type { PaymentMethod } from "@/lib/payment-methods";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { FamilyPaymentMode } from "../schema";
import type { ChildDraft } from "./enrollment-draft";
import type { EnrollmentClassOption } from "./children-step";

const MODES: { mode: FamilyPaymentMode; icon: typeof Receipt }[] = [
  { mode: "FAMILY", icon: ReceiptText },
  { mode: "SEPARATE", icon: Receipt },
];

/**
 * Étape 3 : un montant propre à chaque enfant, le total de la famille calculé
 * à chaque frappe, puis le choix entre un seul paiement pour tous (un reçu
 * unique détaillé) et un paiement par enfant (un reçu chacun).
 */
export function PaymentStep({
  entries,
  classes,
  onAmountChange,
  mode,
  onModeChange,
  method,
  onMethodChange,
}: {
  entries: ChildDraft[];
  classes: EnrollmentClassOption[];
  onAmountChange: (key: string, amount: string) => void;
  mode: FamilyPaymentMode;
  onModeChange: (mode: FamilyPaymentMode) => void;
  method: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
}) {
  const { t } = useLanguage();
  const total = familyTotal(entries.map((c) => c.amount));
  const payingChildren = entries.filter((c) => parseAmount(c.amount) > 0).length;

  return (
    <div className="space-y-4">
      <FormSection icon={Wallet} title={t("family.feesTitle")} bodyClassName="block p-0">
        <p className="px-4 pt-3 text-xs text-foreground/55">{t("family.feesHint")}</p>
        <ul className="divide-y divide-border/70 px-4">
          {entries.map((c) => {
            const name = `${c.firstName} ${c.lastName}`.trim();
            const className = classes.find((cl) => cl.id === c.classId)?.name;
            const inputId = `montant-${c.key}`;
            return (
              <li key={c.key} className="flex flex-wrap items-center gap-3 py-3">
                <StudentAvatar firstName={c.firstName} lastName={c.lastName} photoUrl={null} />
                <div className="min-w-0 flex-1">
                  <label htmlFor={inputId} className="block truncate font-semibold text-foreground">
                    {name}
                  </label>
                  {className && <p className="text-xs text-foreground/55">{className}</p>}
                </div>
                <div className="relative w-40">
                  <input
                    id={inputId}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={50}
                    dir="ltr"
                    value={c.amount}
                    onChange={(e) => onAmountChange(c.key, e.target.value)}
                    aria-label={t("family.amountFor").replace("{name}", name)}
                    placeholder="0"
                    className="h-11 w-full rounded-lg border border-border bg-surface pe-14 ps-3 text-end text-base font-semibold text-foreground [appearance:textfield] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-foreground/45">
                    MRU
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <div
          className="flex items-center justify-between gap-3 border-t border-primary-100 bg-primary-50/70 px-4 py-3.5"
          aria-live="polite"
        >
          <span className="font-semibold text-primary-900">{t("family.total")}</span>
          <span
            data-testid="family-total"
            className="text-2xl font-bold text-primary-800"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatMRU(total)}
          </span>
        </div>
      </FormSection>

      {total === 0 ? (
        <p className="rounded-xl bg-surface-muted/60 px-4 py-3 text-sm text-foreground/60">{t("family.noFeeNote")}</p>
      ) : (
        <FormSection icon={Banknote} title={t("family.paymentMode")} bodyClassName="block space-y-4 p-4">
          {/* Le choix n'a de sens qu'à partir de deux enfants qui paient. */}
          {payingChildren > 1 && (
            <div role="radiogroup" aria-label={t("family.paymentMode")} className="grid gap-2 sm:grid-cols-2">
              {MODES.map(({ mode: m, icon: Icon }) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => onModeChange(m)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3.5 text-start transition-colors",
                    mode === m
                      ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500"
                      : "border-border bg-surface hover:bg-surface-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      mode === m ? "bg-primary-700 text-white" : "bg-primary-50 text-primary-700",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{t(`family.mode.${m}`)}</span>
                    <span className="mt-0.5 block text-xs text-foreground/55">{t(`family.mode.${m}Hint`)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{t("finance.method")}</p>
            <PaymentMethodPicker value={method} onChange={onMethodChange} />
          </div>
        </FormSection>
      )}
    </div>
  );
}
