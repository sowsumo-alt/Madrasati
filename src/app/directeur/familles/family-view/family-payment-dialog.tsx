"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PaymentMethodPicker } from "@/components/payments/payment-method-picker";
import { familyTotal, parseAmount } from "@/lib/family";
import { formatMRU, ltrIsolate } from "@/lib/format";
import type { PaymentMethod } from "@/lib/payment-methods";
import { useLanguage } from "@/lib/i18n/language-provider";
import { recordFamilyPayment } from "../actions";
import type { FamilyOpenFee } from "./types";

/**
 * Paiement familial après l'inscription : le directeur saisit ce que le
 * parent verse pour chaque frais encore dû, le total se calcule tout seul, et
 * un seul reçu est produit.
 */
export function FamilyPaymentDialog({
  open,
  onOpenChange,
  parentId,
  fees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string;
  fees: FamilyOpenFee[];
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAmounts({});
      setMethod("CASH");
    }
  }, [open]);

  const total = familyTotal(fees.map((f) => amounts[f.feeId]));
  const tooHigh = fees.some((f) => parseAmount(amounts[f.feeId]) > f.remaining);

  async function submit() {
    setSaving(true);
    try {
      const { familyPaymentId } = await recordFamilyPayment(parentId, {
        parts: fees.map((f) => ({ feeId: f.feeId, amount: parseAmount(amounts[f.feeId]) })),
        method,
        note: "",
      });
      toast.success(t("family.recorded"));
      onOpenChange(false);
      router.push(`/directeur/finance/recus/famille/${familyPaymentId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("family.payFamily")}</DialogTitle>
          <DialogDescription>{t("family.payHint")}</DialogDescription>
        </DialogHeader>

        {fees.length === 0 ? (
          <p className="rounded-xl bg-surface-muted/60 px-4 py-3 text-sm text-foreground/60">
            {t("family.payNothingDue")}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setAmounts(Object.fromEntries(fees.map((f) => [f.feeId, String(f.remaining)])))
                }
              >
                {t("family.fillAll")}
              </Button>
            </div>
            <ul className="max-h-[45vh] divide-y divide-border/70 overflow-y-auto rounded-xl border border-border/70">
              {fees.map((f) => {
                const over = parseAmount(amounts[f.feeId]) > f.remaining;
                const inputId = `part-${f.feeId}`;
                return (
                  <li key={f.feeId} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
                    <div className="min-w-0 flex-1">
                      <label htmlFor={inputId} className="block truncate text-sm font-semibold text-foreground">
                        {f.studentName}
                        {f.className && <span className="font-normal text-foreground/50"> · {f.className}</span>}
                      </label>
                      <p className="truncate text-xs text-foreground/55">
                        {f.label} — {t("finance.remainingIs").replace("{amount}", ltrIsolate(formatMRU(f.remaining)))}
                      </p>
                    </div>
                    <div className="relative w-36">
                      <input
                        id={inputId}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={f.remaining}
                        dir="ltr"
                        value={amounts[f.feeId] ?? ""}
                        onChange={(e) => setAmounts((a) => ({ ...a, [f.feeId]: e.target.value }))}
                        placeholder="0"
                        aria-invalid={over || undefined}
                        className="h-10 w-full rounded-lg border border-border bg-surface pe-12 ps-3 text-end font-semibold [appearance:textfield] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 aria-[invalid]:border-danger aria-[invalid]:ring-danger/30 [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-foreground/45">
                        MRU
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between rounded-xl bg-primary-50/70 px-4 py-3" aria-live="polite">
              <span className="font-semibold text-primary-900">{t("family.total")}</span>
              <span dir="ltr" className="text-2xl font-bold text-primary-800" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatMRU(total)}
              </span>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">{t("finance.method")}</p>
              <PaymentMethodPicker value={method} onChange={setMethod} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={total === 0 || tooHigh || saving} onClick={submit}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("family.payConfirm").replace("{amount}", ltrIsolate(formatMRU(total)))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
