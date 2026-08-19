"use client";

import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { contractSchema, type ContractFormValues, CONTRACT_TYPES } from "./schema";
import { upsertContract } from "./actions";
import type { TeacherHrRow } from "./rh-view";
import { useLanguage } from "@/lib/i18n/language-provider";

const CONTRACT_LABELS: Record<(typeof CONTRACT_TYPES)[number], string> = {
  CDI: "CDI",
  CDD: "CDD",
  VACATAIRE: "Vacataire / temps partiel",
};

export function ContractDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: TeacherHrRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      teacherId: "",
      type: "CDI",
      startDate: "",
      endDate: "",
      leaveDaysPerYear: 30,
      bonuses: [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "bonuses" });
  const type = watch("type");

  useEffect(() => {
    if (target) {
      reset({
        teacherId: target.id,
        type: (target.contract?.type as ContractFormValues["type"]) ?? "CDI",
        startDate: target.contract?.startDate.slice(0, 10) ?? "",
        endDate: target.contract?.endDate?.slice(0, 10) ?? "",
        leaveDaysPerYear: target.contract?.leaveDaysPerYear ?? 30,
        bonuses: target.contract?.bonuses ?? [],
      });
    }
  }, [target, reset]);

  async function onSubmit(values: ContractFormValues) {
    try {
      await upsertContract(values);
      toast.success(t("hr.contractSaved"));
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contrat de travail</DialogTitle>
          {target && (
            <DialogDescription>
              {target.firstName} {target.lastName}
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contract-type">Type de contrat</Label>
              <Select value={type} onValueChange={(v) => setValue("type", v as ContractFormValues["type"])}>
                <SelectTrigger id="contract-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CONTRACT_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leaveDaysPerYear">{t("hr.leaveDaysPerYear")}</Label>
              <Input
                id="leaveDaysPerYear"
                type="number"
                min={0}
                {...register("leaveDaysPerYear")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startDate">{t("hr.startDate")}</Label>
              <Input id="startDate" type="date" {...register("startDate")} />
              {errors.startDate && (
                <p className="text-xs text-danger">{errors.startDate.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">
                Date de fin{" "}
                <span className="font-normal text-foreground/40">
                  ({type === "CDD" ? "requise" : "si applicable"})
                </span>
              </Label>
              <Input id="endDate" type="date" {...register("endDate")} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("hr.recurringBonuses")}</Label>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => append({ label: "", amount: 0 })}
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </Button>
            </div>
            {fields.length === 0 ? (
              <p className="text-xs text-foreground/40">{t("hr.noRecurringBonus")}</p>
            ) : (
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Input
                      placeholder="Prime de transport"
                      {...register(`bonuses.${index}.label` as const)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="MRU"
                      {...register(`bonuses.${index}.amount` as const)}
                      className="w-28"
                    />
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      title={t("hr.removeBonus")}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/50 hover:bg-red-50 hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
