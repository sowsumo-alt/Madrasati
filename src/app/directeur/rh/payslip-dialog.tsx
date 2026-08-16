"use client";

import { useEffect, useState } from "react";
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
import { formatMRU } from "@/lib/format";
import { generatePayslipSchema, type GeneratePayslipValues } from "./schema";
import { generatePayslip } from "./actions";
import type { TeacherHrRow } from "./rh-view";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export function PayslipDialog({
  target,
  schoolName,
  onOpenChange,
}: {
  target: TeacherHrRow | null;
  schoolName: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [justSaved, setJustSaved] = useState(false);
  const now = new Date();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<GeneratePayslipValues>({
    resolver: zodResolver(generatePayslipSchema),
    defaultValues: {
      teacherId: "",
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      deductions: 0,
      deductionNote: "",
    },
  });
  const month = watch("month");
  const bonusTotal = target?.contract?.bonuses.reduce((s, b) => s + b.amount, 0) ?? 0;
  const baseSalary = target?.monthlySalary ?? 0;

  useEffect(() => {
    if (target) {
      reset({
        teacherId: target.id,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        deductions: 0,
        deductionNote: "",
      });
      setJustSaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reset]);

  async function onSubmit(values: GeneratePayslipValues) {
    try {
      const payslipId = await generatePayslip(values);
      setJustSaved(true);
      toast.success("Bulletin de salaire généré.");
      await new Promise((resolve) => setTimeout(resolve, 400));
      onOpenChange(false);
      window.open(`/directeur/rh/bulletin/${payslipId}`, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Générer le bulletin de salaire</DialogTitle>
          {target && (
            <DialogDescription>
              {target.firstName} {target.lastName} · {schoolName}
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="payslip-month">Mois</Label>
              <Select
                value={String(month)}
                onValueChange={(v) => setValue("month", Number(v))}
              >
                <SelectTrigger id="payslip-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((label, i) => (
                    <SelectItem key={label} value={String(i + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payslip-year">Année</Label>
              <Input id="payslip-year" type="number" {...register("year")} />
            </div>
          </div>

          <div className="rounded-lg bg-surface-muted px-3 py-2.5 text-xs text-foreground/60">
            <div className="flex justify-between">
              <span>Salaire de base</span>
              <span>{formatMRU(baseSalary)}</span>
            </div>
            {bonusTotal > 0 && (
              <div className="mt-1 flex justify-between">
                <span>Primes</span>
                <span>{formatMRU(bonusTotal)}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="payslip-deductions">
                Déductions{" "}
                <span className="font-normal text-foreground/40">(optionnel)</span>
              </Label>
              <Input id="payslip-deductions" type="number" min={0} {...register("deductions")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payslip-deductionNote">Motif</Label>
              <Input id="payslip-deductionNote" {...register("deductionNote")} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting} className={cn(justSaved && "bg-primary-600")}>
              {isSubmitting && !justSaved && <Loader2 className="h-4 w-4 animate-spin" />}
              {justSaved && <Check className="h-4 w-4 animate-check-pop" />}
              Générer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
