"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Banknote, FilePlus2, Loader2, Pencil, Save, Tag, UserRound, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSection } from "@/components/forms/form-section";
import { FormField, IconInput } from "@/components/forms/form-field";
import { formatMRU } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-provider";
import { feeSchema, type FeeFormValues } from "./schema";
import { createFee, updateFee } from "./actions";

export interface FeeStudentOption {
  id: string;
  firstName: string;
  lastName: string;
  className: string | null;
}

export interface FeeEditTarget {
  id: string;
  studentName: string;
  className: string | null;
  label: string;
  amount: number;
  /** ISO */
  dueDate: string;
  totalPaid: number;
}

const SUGGESTIONS = [
  "finance.suggestion.tuition",
  "finance.suggestion.enrollment",
  "finance.suggestion.transport",
  "finance.suggestion.canteen",
] as const;

/** Création d'un frais, ou correction d'un frais existant (`editTarget`). */
export function FeeFormDialog({
  open,
  onOpenChange,
  students,
  editTarget = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: FeeStudentOption[];
  editTarget?: FeeEditTarget | null;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FeeFormValues>({
    resolver: zodResolver(feeSchema),
    defaultValues: { studentId: "", label: "", amount: 0, dueDate: "" },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      editTarget
        ? {
            // L'élève d'un frais existant ne change pas : cette valeur ne sert
            // qu'à satisfaire la validation, elle n'est jamais envoyée.
            studentId: "edit",
            label: editTarget.label,
            amount: editTarget.amount,
            dueDate: editTarget.dueDate.slice(0, 10),
          }
        : { studentId: "", label: "", amount: 0, dueDate: "" },
    );
  }, [open, editTarget, reset]);

  async function onSubmit(values: FeeFormValues) {
    try {
      if (editTarget) {
        await updateFee(editTarget.id, {
          label: values.label,
          amount: values.amount,
          dueDate: values.dueDate,
        });
        toast.success(t("finance.feeUpdated"));
      } else {
        await createFee(values);
        toast.success(t("finance.feeAdded"));
      }
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  const studentId = watch("studentId");
  const student = students.find((s) => s.id === studentId);
  const HeaderIcon = editTarget ? Pencil : FilePlus2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-xl flex-col overflow-y-hidden p-0">
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="flex items-center gap-4 border-b border-border px-5 py-4 pe-12 sm:px-6">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 ring-4 ring-primary-50/70">
              <HeaderIcon className="h-7 w-7" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-lg">
                {editTarget ? t("finance.editFee") : t("finance.newFee")}
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                {editTarget
                  ? `${editTarget.studentName}${editTarget.className ? ` · ${editTarget.className}` : ""}`
                  : t("finance.newFeeDescription")}
              </DialogDescription>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted/30 px-5 py-5 sm:px-6">
            <FormSection icon={Wallet} title={t("finance.feeSection")}>
              {!editTarget && (
                <FormField
                  label={t("finance.student")}
                  htmlFor="fee-student"
                  required
                  error={errors.studentId?.message}
                  className="sm:col-span-2"
                >
                  <Select
                    value={studentId || undefined}
                    onValueChange={(v) => setValue("studentId", v, { shouldValidate: true })}
                  >
                    <SelectTrigger id="fee-student">
                      <span className="flex min-w-0 items-center gap-2">
                        <UserRound className="h-4 w-4 shrink-0 text-foreground/40" />
                        <SelectValue placeholder={t("finance.selectStudent")}>
                          {student
                            ? `${student.firstName} ${student.lastName}${student.className ? ` — ${student.className}` : ""}`
                            : undefined}
                        </SelectValue>
                      </span>
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
              )}

              <FormField
                label={t("finance.colFeeType")}
                htmlFor="fee-label"
                required
                error={errors.label?.message}
                className="sm:col-span-2"
              >
                <IconInput
                  icon={Tag}
                  id="fee-label"
                  list="fee-label-suggestions"
                  placeholder={t("finance.labelPlaceholder")}
                  {...register("label")}
                />
                <datalist id="fee-label-suggestions">
                  {SUGGESTIONS.map((key) => (
                    <option key={key} value={t(key)} />
                  ))}
                </datalist>
              </FormField>

              <FormField
                label={t("finance.amountMru")}
                htmlFor="fee-amount"
                required
                error={errors.amount?.message}
                hint={
                  editTarget && editTarget.totalPaid > 0
                    ? t("finance.alreadyPaid").replace("{amount}", formatMRU(editTarget.totalPaid))
                    : undefined
                }
              >
                <IconInput
                  icon={Banknote}
                  id="fee-amount"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  {...register("amount")}
                />
              </FormField>

              <FormField label={t("finance.dueDate")} htmlFor="fee-due" required error={errors.dueDate?.message}>
                <DateInput id="fee-due" {...register("dueDate")} />
              </FormField>
            </FormSection>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Button type="button" variant="secondary" className="sm:min-w-28" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="sm:min-w-36">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
