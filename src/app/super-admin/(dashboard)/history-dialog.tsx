"use client";

import { useEffect, useState } from "react";
import { Loader2, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatMRU, formatDate } from "@/lib/format";
import { getPaymentHistory, type SubscriptionPaymentRow } from "./actions";

export function HistoryDialog({
  target,
  onOpenChange,
}: {
  target: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [payments, setPayments] = useState<SubscriptionPaymentRow[] | null>(null);

  useEffect(() => {
    if (!target) {
      setPayments(null);
      return;
    }
    let cancelled = false;
    getPaymentHistory(target.id).then((rows) => {
      if (!cancelled) setPayments(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Historique des paiements</DialogTitle>
          {target && <DialogDescription>{target.name}</DialogDescription>}
        </DialogHeader>

        {payments === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-foreground/40" />
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Receipt className="h-6 w-6 text-foreground/30" />
            <p className="text-sm text-foreground/50">Aucun paiement enregistré pour l&apos;instant.</p>
          </div>
        ) : (
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">{formatMRU(p.amount)}</p>
                  <p className="text-xs text-foreground/50">{formatDate(p.paidAt)}</p>
                </div>
                {p.note && <p className="max-w-[55%] truncate text-xs text-foreground/50">{p.note}</p>}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
