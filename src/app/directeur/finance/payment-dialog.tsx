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
import { PaymentMethodPicker } from "@/components/payments/payment-method-picker";
import { formatMRU } from "@/lib/format";
import { allocateOldestFirst } from "@/lib/tuition";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import { paymentSchema, type PaymentFormValues } from "./schema";
import { recordPayment } from "./actions";
import type { FeeRow } from "./finance-view";
import { useSubmissionKeys } from "@/lib/submission-key";

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
  const submission = useSubmissionKeys();
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
  // Du plus ancien au plus récent : le premier proposé est celui à régler.
  const studentFees = unsettled
    .filter((f) => f.student.id === studentId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const fee = fees.find((f) => f.id === (feeId ?? chosenFeeId)) ?? null;
  const student = students.find((s) => s.id === studentId) ?? fee?.student ?? null;

  // Échéance d'une formule : le versement règle les mois du plus ancien au
  // plus récent (voir recordPayment), sur plusieurs mois s'il le faut.
  const planOpen = useMemo(
    () =>
      fee?.tuitionPlanId
        ? unsettled
            .filter((f) => f.tuitionPlanId === fee.tuitionPlanId)
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        : null,
    [fee, unsettled],
  );
  const shown = planOpen?.[0] ?? fee;
  const planLeft = planOpen?.reduce((sum, f) => sum + f.remaining, 0) ?? null;
  const typedAmount = Number(watch("amount")) || 0;
  const allocation = planOpen && typedAmount > 0 ? allocateOldestFirst(planOpen, typedAmount) : null;
  const tooMuch = planLeft != null && typedAmount > planLeft;

  /** Montant proposé : ce qui reste sur le mois à régler en premier. */
  function suggestedAmount(target: FeeRow | undefined) {
    if (!target) return 0;
    if (!target.tuitionPlanId) return target.remaining;
    const oldest = unsettled
      .filter((f) => f.tuitionPlanId === target.tuitionPlanId)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    return (oldest ?? target).remaining;
  }

  useEffect(() => {
    if (!open) return;
    const fixed = feeId ? fees.find((f) => f.id === feeId) : undefined;
    setStudentId(fixed?.student.id ?? "");
    setChosenFeeId(fixed?.id ?? "");
    setFeeError(null);
    setJustSaved(false);
    reset({ amount: suggestedAmount(fixed), method: "CASH", note: "" });
    // suggestedAmount ne dépend que de `fees`, déjà suivi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, feeId, fees, reset]);

  function chooseStudent(id: string) {
    // Radix Select signale une valeur vide quand la valeur affichée n'est pas
    // (encore) parmi ses options : ignorée, sinon le frais choisi d'office
    // pour l'élève était aussitôt effacé et le montant remis à zéro.
    if (!id) return;
    setStudentId(id);
    // Le plus ancien reste à régler, choisi d'office.
    const oldest = unsettled
      .filter((f) => f.student.id === id)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    setChosenFeeId(oldest?.id ?? "");
    setValue("amount", suggestedAmount(oldest));
    setFeeError(null);
  }

  function chooseFee(id: string) {
    if (!id) return;
    setChosenFeeId(id);
    setValue("amount", suggestedAmount(fees.find((f) => f.id === id)), { shouldValidate: true });
    setFeeError(null);
  }

  async function onSubmit(values: PaymentFormValues) {
    if (!fee || tooMuch) return;
    try {
      const result = await recordPayment(fee.id, values, submission.keyFor(fee.id));
      submission.done(fee.id);
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
                    <p className="truncate text-xs text-foreground/60">{shown?.label ?? fee.label}</p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-xs text-foreground/50">{t("finance.remaining")}</p>
                    <p className="font-bold text-primary-800" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatMRU(shown?.remaining ?? fee.remaining)}
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
                <PaymentMethodPicker value={method} onChange={(m) => setValue("method", m)} />
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
                {allocation && allocation.length > 0 && !tooMuch && (
                  <p className="mt-1.5 text-xs text-primary-800" data-testid="payment-allocation">
                    Ce paiement règle :{" "}
                    {allocation
                      .map(
                        (p) =>
                          `${p.item.label.replace("Frais de scolarité — ", "")} (${formatMRU(p.amount)}${
                            p.amount < p.item.remaining ? " sur " + formatMRU(p.item.remaining) : ""
                          })`,
                      )
                      .join(" · ")}
                  </p>
                )}
                {tooMuch && planLeft != null && (
                  <p className="mt-1.5 text-xs font-medium text-danger" data-testid="payment-too-much">
                    Plus que ce qui reste à payer pour l&apos;année ({formatMRU(planLeft)}).
                  </p>
                )}
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
            <Button type="submit" disabled={isSubmitting || tooMuch} className={cn("sm:min-w-44", justSaved && "bg-primary-600")}>
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
