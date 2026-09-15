"use client";

import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment-methods";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { PaymentMethodIcon } from "./payment-method-label";

/** Tuiles de choix du mode de paiement (espèces, Bankily, chèque…). */
export function PaymentMethodPicker({
  value,
  onChange,
  className,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  className?: string;
}) {
  const { t } = useLanguage();

  return (
    <div
      role="radiogroup"
      aria-label={t("finance.method")}
      className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", className)}
    >
      {PAYMENT_METHODS.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          onClick={() => onChange(m)}
          className={cn(
            "flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition-colors",
            value === m
              ? "border-primary-500 bg-primary-50 text-primary-900 ring-1 ring-primary-500"
              : "border-border bg-surface text-foreground/80 hover:bg-surface-muted",
          )}
        >
          <PaymentMethodIcon method={m} />
          <span className="min-w-0 truncate text-sm font-medium">
            {t(`finance.methodShort.${m}` as TranslationKey)}
          </span>
        </button>
      ))}
    </div>
  );
}
