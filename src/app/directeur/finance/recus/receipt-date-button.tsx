"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { todayIso } from "@/lib/family-sheet";
import { changeReceiptDate } from "./receipt-date-actions";

/** « Modifier la date » : la date de paiement écrite sur la fiche, pas celle de la saisie. */
export function ReceiptDateButton({
  target,
  current,
}: {
  target: { paymentId: string } | { familyPaymentId: string };
  /** Date actuelle du reçu, AAAA-MM-JJ. */
  current: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(current);
  const [saving, setSaving] = useState(false);
  const today = todayIso();

  async function save() {
    setSaving(true);
    try {
      const result = await changeReceiptDate({ ...target, date });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Date du reçu modifiée.");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("La modification n'a pas abouti. Vérifiez la connexion et réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} data-testid="receipt-date-edit">
        <CalendarDays className="h-4 w-4" />
        Modifier la date
      </Button>
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Date de paiement</DialogTitle>
            <DialogDescription>
              La date écrite sur la fiche de paiement. Le reçu, l&apos;argent perçu de ce jour et le reste dû suivent
              cette date.
            </DialogDescription>
          </DialogHeader>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"
            data-testid="receipt-date-input"
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={save} disabled={saving || !date || date > today} data-testid="receipt-date-save">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
