"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cancelPaymentAction } from "../cancel-actions";

/**
 * « Annuler ce paiement » : motif obligatoire, puis le reçu est marqué
 * « ANNULÉ » et l'échéance redevient à régler. Rien n'est effacé.
 */
export function CancelReceiptButton({
  target,
  amountLabel,
  family = false,
}: {
  target: { paymentId: string } | { familyPaymentId: string };
  /** « 9 500 MRU » */
  amountLabel: string;
  /** Reçu familial : toutes ses lignes sont annulées ensemble. */
  family?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function confirm() {
    setSaving(true);
    try {
      const result = await cancelPaymentAction({ ...target, reason });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Paiement annulé (${amountLabel}). Le reçu est marqué « ANNULÉ ».`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("L'annulation n'a pas abouti. Rien n'a été modifié : réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="no-print text-red-700"
        onClick={() => setOpen(true)}
        data-testid="cancel-receipt"
      >
        <Ban className="h-4 w-4" />
        Annuler ce paiement
      </Button>
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="max-w-md" data-testid="cancel-dialog">
          <DialogHeader>
            <DialogTitle>Annuler ce paiement de {amountLabel} ?</DialogTitle>
            <DialogDescription>
              {family
                ? "Toutes les lignes de ce reçu familial seront annulées. "
                : ""}
              Le reçu restera consultable, marqué « ANNULÉ » ; l&apos;argent perçu baissera de {amountLabel} et
              les mois concernés redeviendront à payer. Vous pourrez ensuite ré-encaisser le bon montant.
            </DialogDescription>
          </DialogHeader>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Motif (obligatoire)</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="Ex. : montant saisi par erreur, à ré-encaisser"
              className="w-full rounded-lg border border-border bg-surface p-2 text-sm"
              data-testid="cancel-reason"
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Retour
            </Button>
            <Button
              type="button"
              onClick={confirm}
              disabled={saving || reason.trim().length < 3}
              className="bg-red-700 hover:bg-red-800"
              data-testid="cancel-confirm"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Annuler le paiement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
