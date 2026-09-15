"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Banknote, Check, Loader2, NotebookPen, Save, UserRound, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSection } from "@/components/forms/form-section";
import { FormField, IconInput } from "@/components/forms/form-field";
import { StudentAvatar } from "@/components/students/student-avatar";
import { PaymentMethodIcon } from "@/components/payments/payment-method-label";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { formatMRU } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { paymentSchema, type PaymentFormValues } from "./schema";
import { recordPayment } from "./actions";
import type { FeeRow } from "./finance-view";

/**
 * Enregistrement d'un paiement. Ouverte depuis une ligne, la fenêtre porte sur
 * ce frais ; ouverte par « Nouveau paiement », le directeur choisit l'élève
 * puis celui de ses frais qui reste à régler — le plus souvent il n'y en a
 * qu'un, et il est choisi d'office.
 */
export function PaymentDialog({
  open,
  onOpenChange,
  fees,
  feeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fees: FeeRow[];
  /** Frais imposé (ouvert depuis une ligne), sinon `null`. */
  feeId: string | null;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [studentId, setStudentId] = useState("");
  const [chosenFeeId, setChosenFeeId] = useState("");
  const [feeError, setFeeError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
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

  const unsettled = useMemo(() => fees.filter((f) => f.remaining > 0), [fees]);
  const students = useMemo(() => {
    const byId = new Map<string, FeeRow["student"]>();
    for (const f of unsettled) byId.set(f.student.id, f.student);
    return [...byId.values()].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "fr"),
    );
  }, [unsettled]);
  const studentFees = unsettled.filter((f) => f.student.id === studentId);
  const fee = fees.find((f) => f.id === (feeId ?? chosenFeeId)) ?? null;
  const student = students.find((s) => s.id === studentId) ?? fee?.student ?? null;

  useEffect(() => {
    if (!open) return;
    const fixed = feeId ? fees.find((f) => f.id === feeId) : undefined;
    setStudentId(fixed?.student.id ?? "");
    setChosenFeeId(fixed?.id ?? "");
    setFeeError(null);
    setJustSaved(false);
    reset({ amount: fixed?.remaining ?? 0, method: "CASH", note: "" });
  }, [open, feeId, fees, reset]);

  function chooseStudent(id: string) {
    // Radix Select signale une valeur vide quand la valeur affichée n'est pas
    // (encore) parmi ses options : ignorée, sinon le frais choisi d'office
    // pour l'élève était aussitôt effacé et le montant remis à zéro.
    if (!id) return;
    setStudentId(id);
    const own = unsettled.filter((f) => f.student.id === id);
    const only = own.length === 1 ? own[0] : null;
    setChosenFeeId(only?.id ?? "");
    setValue("amount", only?.remaining ?? 0);
    setFeeError(null);
  }

  function chooseFee(id: string) {
    if (!id) return;
    setChosenFeeId(id);
    setValue("amount", fees.find((f) => f.id === id)?.remaining ?? 0, { shouldValidate: true });
    setFeeError(null);
  }

  async function onSubmit(values: PaymentFormValues) {
    if (!fee) return;
    try {
      const result = await recordPayment(fee.id, values);
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

  function submit(event: FormEvent<HTMLFormElement>) {
    if (!fee) setFeeError(t("finance.selectFee"));
    handleSubmit(onSubmit)(event);
  }

  const method = watch("method");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col overflow-y-hidden p-0">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="flex items-center gap-4 border-b border-border px-5 py-4 pe-12 sm:px-6">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 ring-4 ring-primary-50/70">
              <Wallet className="h-7 w-7" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-lg">
                {feeId ? t("finance.recordPaymentTitle") : t("finance.newPayment")}
              </DialogTitle>
              <DialogDescription className="mt-0.5">{t("finance.newPaymentDescription")}</DialogDescription>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface-muted/30 px-5 py-5 sm:px-6">
            <FormSection icon={UserRound} title={t("finance.studentAndFee")}>
              {!feeId && (
                <>
                  <FormField label={t("finance.student")} htmlFor="payment-student" required>
                    <Select value={studentId || undefined} onValueChange={chooseStudent}>
                      <SelectTrigger id="payment-student">
                        <SelectValue placeholder={t("finance.selectStudent")}>
                          {student && studentId ? `${student.firstName} ${student.lastName}` : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {students.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.firstName} {s.lastName}
                            {s.className ? ` — ${s.className}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField
                    label={t("finance.feeToPay")}
                    htmlFor="payment-fee"
                    required
                    error={feeError ?? undefined}
                  >
                    <Select value={chosenFeeId || undefined} onValueChange={chooseFee} disabled={!studentId}>
                      <SelectTrigger id="payment-fee">
                        <SelectValue placeholder={t("finance.selectFee")}>
                          {fee ? fee.label : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {studentFees.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.label} — {t("finance.remainingIs").replace("{amount}", formatMRU(f.remaining))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </>
              )}

              {fee && (
                <div className="flex items-center gap-3 rounded-xl bg-primary-50/60 p-3 ring-1 ring-primary-100 sm:col-span-2">
                  <StudentAvatar
                    firstName={fee.student.firstName}
                    lastName={fee.student.lastName}
                    photoUrl={fee.student.photoUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">
                      {fee.student.firstName} {fee.student.lastName}
                      {fee.student.className && (
                        <span className="ms-2 text-xs font-medium text-primary-700">{fee.student.className}</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-foreground/60">{fee.label}</p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-xs text-foreground/50">{t("finance.remaining")}</p>
                    <p className="font-bold text-primary-800" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatMRU(fee.remaining)}
                    </p>
                  </div>
                </div>
              )}
            </FormSection>

            <FormSection icon={Banknote} title={t("finance.paymentSection")}>
              <div className="space-y-1.5 sm:col-span-2">
                <p className="text-sm font-medium text-foreground">
                  {t("finance.method")}
                  <span className="ms-0.5 text-danger" aria-hidden>
                    *
                  </span>
                </p>
                <div role="radiogroup" aria-label={t("finance.method")} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={method === m}
                      onClick={() => setValue("method", m)}
                      className={cn(
                        "flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition-colors",
                        method === m
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
              </div>

              <FormField
                label={t("finance.paidAmountMru")}
                htmlFor="payment-amount"
                required
                error={errors.amount?.message}
              >
                <IconInput
                  icon={Banknote}
                  id="payment-amount"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  {...register("amount")}
                />
              </FormField>
              <FormField
                label={method === "CHEQUE" ? t("finance.chequeNumber") : t("finance.note")}
                htmlFor="payment-note"
                hint={t("common.optional")}
              >
                <IconInput icon={NotebookPen} id="payment-note" {...register("note")} />
              </FormField>
            </FormSection>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Button type="button" variant="secondary" className="sm:min-w-28" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting} className={cn("sm:min-w-44", justSaved && "bg-primary-600")}>
              {justSaved ? (
                <Check className="h-4 w-4 animate-check-pop" />
              ) : isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t("finance.savePayment")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
