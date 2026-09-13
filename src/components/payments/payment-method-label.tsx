"use client";

import { Banknote, Landmark, ScrollText, Smartphone, type LucideIcon } from "lucide-react";
import { PaymentMethodLogo } from "@/components/ui/payment-method-logo";
import { PAYMENT_METHOD_LOGOS, isPaymentMethod, type PaymentMethod } from "@/lib/payment-methods";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

const ICONS: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  BANK_TRANSFER: Landmark,
  CHEQUE: ScrollText,
  MASRVI: Smartphone,
  SEDAD: Smartphone,
  BAKILY: Smartphone,
};

/** Pastille d'un mode de paiement : le logo de la marque (Masrvi, Sedad, Bankily) ou une icône. */
export function PaymentMethodIcon({
  method,
  compact = false,
}: {
  method: string;
  compact?: boolean;
}) {
  const box = compact ? "h-6 w-6 rounded-md" : "h-8 w-8 rounded-lg";

  if (isPaymentMethod(method) && PAYMENT_METHOD_LOGOS[method]) {
    return (
      <span className={cn("flex shrink-0 items-center justify-center bg-surface ring-1 ring-border", box)}>
        <PaymentMethodLogo method={method} className={compact ? "h-4 w-4" : undefined} />
      </span>
    );
  }

  const Icon = isPaymentMethod(method) ? ICONS[method] : Banknote;
  return (
    <span className={cn("flex shrink-0 items-center justify-center bg-surface-muted text-foreground/60", box)}>
      <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </span>
  );
}

/** Mode de paiement avec sa pastille ; `short` donne « Virement » plutôt que « Virement bancaire ». */
export function PaymentMethodLabel({
  method,
  short = false,
  compact = false,
}: {
  method: string;
  short?: boolean;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const label = isPaymentMethod(method)
    ? t(`finance.${short ? "methodShort" : "method"}.${method}` as TranslationKey)
    : method;

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <PaymentMethodIcon method={method} compact={compact} />
      <span className={cn("truncate text-foreground/75", compact ? "text-xs" : "text-sm")}>{label}</span>
    </span>
  );
}
