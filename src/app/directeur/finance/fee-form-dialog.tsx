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
import { feeSchema, type FeeFormValues } from "./schema";
import { createFee } from "./actions";
import { useLanguage } from "@/lib/i18n/language-provider";

export interface FeeStudentOption {
  id: string;
  firstName: string;
  lastName: string;
  className: string | null;
}

interface FeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: FeeStudentOption[];
}

export function FeeFormDialog({ open, onOpenChange, students }: FeeFormDialogProps) {
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
    if (open) reset({ studentId: "", label: "", amount: 0, dueDate: "" });
  }, [open, reset]);

  async function onSubmit(values: FeeFormValues) {
    try {
      await createFee(values);
      toast.success(t("finance.feeAdded"));
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    }
  }

  const studentId = watch("studentId");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("finance.newFee")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label>{t("finance.student")}</Label>
            <Select
              value={studentId || undefined}
              onValueChange={(v) => setValue("studentId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("finance.selectStudent")} />
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
            {errors.studentId && (
              <p className="text-xs text-danger">{errors.studentId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="label">{t("finance.label")}</Label>
            <Input
              id="label"
              placeholder={t("finance.labelPlaceholder")}
              {...register("label")}
            />
            {errors.label && (
              <p className="text-xs text-danger">{errors.label.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">{t("finance.amountMru")}</Label>
              <Input id="amount" type="number" min={0} {...register("amount")} />
              {errors.amount && (
                <p className="text-xs text-danger">{errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">{t("finance.dueDate")}</Label>
              <Input id="dueDate" type="date" {...register("dueDate")} />
              {errors.dueDate && (
                <p className="text-xs text-danger">{errors.dueDate.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
