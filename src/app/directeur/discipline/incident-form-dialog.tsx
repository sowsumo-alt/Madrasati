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
import { cn } from "@/lib/utils";
import { incidentSchema, type IncidentFormValues } from "./schema";
import { createIncident } from "./actions";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

export interface IncidentStudentOption {
  id: string;
  firstName: string;
  lastName: string;
  className: string | null;
}

const INCIDENT_TYPES = [
  "WARNING",
  "REPRIMAND",
  "SUMMONS",
  "SUSPENSION",
  "OTHER",
] as const;

const TYPE_KEYS: Record<(typeof INCIDENT_TYPES)[number], TranslationKey> = {
  WARNING: "discipline.type.WARNING",
  REPRIMAND: "discipline.type.REPRIMAND",
  SUMMONS: "discipline.type.SUMMONS",
  SUSPENSION: "discipline.type.SUSPENSION",
  OTHER: "discipline.type.OTHER",
};

interface IncidentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: IncidentStudentOption[];
}

export function IncidentFormDialog({ open, onOpenChange, students }: IncidentFormDialogProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      studentId: "",
      date: "",
      type: "WARNING",
      description: "",
      sanction: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        studentId: "",
        date: "",
        type: "WARNING",
        description: "",
        sanction: "",
      });
    }
  }, [open, reset]);

  async function onSubmit(values: IncidentFormValues) {
    try {
      await createIncident(values);
      toast.success(t("discipline.incidentAdded"));
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    }
  }

  const studentId = watch("studentId");
  const type = watch("type");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("discipline.newIncident")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="incident-student-select">{t("discipline.student")}</Label>
            <Select
              value={studentId || undefined}
              onValueChange={(v) => setValue("studentId", v)}
            >
              <SelectTrigger id="incident-student-select">
                <SelectValue placeholder={t("discipline.selectStudent")} />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="incident-type-select">{t("discipline.type")}</Label>
              <Select
                value={type}
                onValueChange={(v) => setValue("type", v as IncidentFormValues["type"])}
              >
                <SelectTrigger id="incident-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map((ty) => (
                    <SelectItem key={ty} value={ty}>
                      {t(TYPE_KEYS[ty])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-xs text-danger">{errors.type.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">{t("discipline.date")}</Label>
              <Input id="date" type="date" {...register("date")} />
              {errors.date && (
                <p className="text-xs text-danger">{errors.date.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">{t("discipline.description")}</Label>
            <textarea
              id="description"
              rows={3}
              placeholder={t("discipline.descriptionPlaceholder")}
              className={cn(
                "flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50",
              )}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-danger">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sanction">{t("discipline.sanction")}</Label>
            <Input
              id="sanction"
              placeholder={t("discipline.sanctionPlaceholder")}
              {...register("sanction")}
            />
            {errors.sanction && (
              <p className="text-xs text-danger">{errors.sanction.message}</p>
            )}
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
