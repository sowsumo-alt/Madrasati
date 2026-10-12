"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMRU } from "@/lib/format";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payment-methods";
import { useSubmissionKeys } from "@/lib/submission-key";
import { correctPaymentAction } from "../correct-actions";

const field = "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm";

/**
 * « Corriger ce paiement » : le bon montant, mode ou jour, et un motif. Un
 * nouveau reçu remplace l'ancien, qui reste lisible, marqué « ANNULÉ —
 * corrigé par REC-… » : plus besoin de supprimer un élève pour refaire ses comptes.
 */
export function CorrectPaymentButton({
  payment,
  compact = false,
}: {
  payment: { id: string; amount: number; method: string; paidAt: string; receiptNumber: string };
  /** Petit bouton (icône), pour une liste de versements. */
  compact?: boolean;
}) {
  const router = useRouter();
  const submission = useSubmissionKeys();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const [method, setMethod] = useState(payment.method);
  const [paidOn, setPaidOn] = useState(payment.paidAt.slice(0, 10));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  function openDialog() {
    setAmount(String(payment.amount));
    setMethod(payment.method);
    setPaidOn(payment.paidAt.slice(0, 10));
    setReason("");
    setOpen(true);
  }

  async function confirm() {
    setSaving(true);
    try {
      const result = await correctPaymentAction({
        paymentId: payment.id,
        amount: Number(amount.replace(/\s/g, "")),
        method: method as PaymentMethod,
        paidOn,
        reason,
        submissionKey: submission.keyFor(payment.id),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      submission.done(payment.id);
      toast.success(`Paiement corrigé : nouveau reçu ${result.receiptNumber}. L'ancien reçu ${payment.receiptNumber} est marqué « ANNULÉ ».`);
      setOpen(false);
      router.push(`/directeur/finance/recus/${result.paymentId}`);
      router.refresh();
    } catch {
      toast.error("La correction n'a pas abouti. Rien n'a été modifié : réessayez.");
    } finally {
      setSaving(false);
    }
  }

  const typed = Number(amount.replace(/\s/g, ""));
  const valid = Number.isInteger(typed) && typed > 0 && reason.trim().length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(paidOn);

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={openDialog}
          title="Corriger ce paiement"
          aria-label="Corriger ce paiement"
          className="no-print flex h-9 w-9 items-center justify-center rounded-lg text-primary-700 transition-colors hover:bg-primary-50"
          data-testid="correct-payment-compact"
        >
          <PenLine className="h-4 w-4" />
        </button>
      ) : (
        <Button type="button" variant="secondary" className="no-print" onClick={openDialog} data-testid="correct-payment">
          <PenLine className="h-4 w-4" />
          Corriger ce paiement
        </Button>
      )}
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="max-w-md" data-testid="correct-dialog">
          <DialogHeader>
            <DialogTitle>Corriger le reçu {payment.receiptNumber}</DialogTitle>
            <DialogDescription>
              Saisi : {formatMRU(payment.amount)}. Indiquez ce qui a vraiment été reçu. Un nouveau reçu sera créé ;
              l&apos;ancien restera consultable, marqué « ANNULÉ », avec votre motif.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <label className="block space-y-1.5">
              <span className="font-medium">Montant reçu (MRU)</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="numeric"
                dir="ltr"
                className={field}
                data-testid="correct-amount"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="font-medium">Mode</span>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={field} data-testid="correct-method">
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="font-medium">Jour</span>
                <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={field} />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="font-medium">Motif (obligatoire)</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Ex. : un zéro de trop, le parent a versé 1 000"
                className="w-full rounded-lg border border-border bg-surface p-2"
                data-testid="correct-reason"
              />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Retour
            </Button>
            <Button type="button" onClick={confirm} disabled={saving || !valid} data-testid="correct-confirm">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Corriger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
