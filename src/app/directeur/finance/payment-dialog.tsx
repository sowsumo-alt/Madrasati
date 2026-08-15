"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { useLanguage } from "@/lib/i18n/language-provider";

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "MASRVI", "SEDAD", "BAKILY"] as const;

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
  const { t } = useLanguage();
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
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (target) {
      reset({ amount: target.remaining, method: "CASH", note: "" });
      setJustSaved(false);
    }
  }, [target, reset]);

  async function onSubmit(values: PaymentFormValues) {
    if (!target) return;
    try {
      const result = await recordPayment(target.feeId, values);
      // Un court accusé de réception visuel avant de fermer : sans lui, le
      // paiement disparaît de l'écran si vite que rien ne confirme qu'il a
      // bien été enregistré.
      setJustSaved(true);
      toast.success(t("finance.paymentSaved"));
      await new Promise((resolve) => setTimeout(resolve, 450));
      onOpenChange(false);
      router.refresh();
      window.open(`/directeur/finance/recus/${result.paymentId}`, "_blank");
    } catch {
      toast.error(t("common.error"));
    }
  }

  const method = watch("method");

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("finance.recordPaymentTitle")}</DialogTitle>
          {target && (
            <DialogDescription>
              {target.studentName} — {target.label} · {t("finance.remaining")}:{" "}
              {formatMRU(target.remaining)}
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">{t("finance.paidAmountMru")}</Label>
              <Input id="amount" type="number" min={0} {...register("amount")} />
              {errors.amount && (
                <p className="text-xs text-danger">{errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-method-select">{t("finance.method")}</Label>
              <Select
                value={method}
                onValueChange={(v) =>
                  setValue("method", v as PaymentFormValues["method"])
                }
              >
                <SelectTrigger id="payment-method-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`finance.method.${value}` as const)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">
              {t("finance.note")}{" "}
              <span className="font-normal text-foreground/40">
                ({t("common.optional")})
              </span>
            </Label>
            <Input id="note" {...register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(justSaved && "bg-primary-600")}
            >
              {isSubmitting && !justSaved && <Loader2 className="h-4 w-4 animate-spin" />}
              {justSaved && <Check className="h-4 w-4 animate-check-pop" />}
              {t("finance.recordPayment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
