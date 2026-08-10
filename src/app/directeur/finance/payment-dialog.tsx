"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { paymentSchema, type PaymentFormValues } from "./schema";
import { recordPayment } from "./actions";
import { formatMRU } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/roles";

interface PaymentDialogTarget {
  feeId: string;
  studentName: string;
  label: string;
  remaining: number;
}

interface PaymentDialogProps {
  target: PaymentDialogTarget | null;
  onOpenChange: (open: boolean) => void;
}

export function PaymentDialog({ target, onOpenChange }: PaymentDialogProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, method: "CASH", note: "" },
  });

  useEffect(() => {
    if (target) {
      reset({ amount: target.remaining, method: "CASH", note: "" });
    }
  }, [target, reset]);

  async function onSubmit(values: PaymentFormValues) {
    if (!target) return;
    try {
      const result = await recordPayment(target.feeId, values);
      toast.success("Paiement enregistré.");
      onOpenChange(false);
      router.refresh();
      window.open(`/directeur/finance/recus/${result.paymentId}`, "_blank");
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    }
  }

  const method = watch("method");

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
          {target && (
            <DialogDescription>
              {target.studentName} — {target.label} · Restant dû :{" "}
              {formatMRU(target.remaining)}
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Montant payé (MRU)</Label>
              <Input id="amount" type="number" min={0} {...register("amount")} />
              {errors.amount && (
                <p className="text-xs text-danger">{errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Mode de paiement</Label>
              <Select
                value={method}
                onValueChange={(v) =>
                  setValue("method", v as PaymentFormValues["method"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">
              Note <span className="font-normal text-foreground/40">(optionnel)</span>
            </Label>
            <Input id="note" {...register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer le paiement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
