"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
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
import { formatDate } from "@/lib/format";
import { leaveSchema, type LeaveFormValues, LEAVE_REASONS } from "./schema";
import { recordLeave, deleteLeave } from "./actions";
import type { TeacherHrRow } from "./rh-view";
import { useLanguage } from "@/lib/i18n/language-provider";

const REASON_LABELS: Record<(typeof LEAVE_REASONS)[number], string> = {
  ANNUAL: "Congé annuel",
  SICK: "Congé maladie",
  OTHER: "Autre",
};

export function LeaveDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: TeacherHrRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { teacherId: "", startDate: "", endDate: "", reason: "ANNUAL", note: "" },
  });
  const reason = watch("reason");

  useEffect(() => {
    if (target) {
      reset({ teacherId: target.id, startDate: "", endDate: "", reason: "ANNUAL", note: "" });
    }
  }, [target, reset]);

  async function onSubmit(values: LeaveFormValues) {
    try {
      await recordLeave(values);
      toast.success(t("hr.leaveSaved"));
      reset({ teacherId: values.teacherId, startDate: "", endDate: "", reason: "ANNUAL", note: "" });
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  async function handleDelete(leaveId: string) {
    setDeletingId(leaveId);
    try {
      await deleteLeave(leaveId);
      onSaved();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("hr.leaves")}</DialogTitle>
          {target && (
            <DialogDescription>
              {target.firstName} {target.lastName} · Solde : {target.leaveBalance} /{" "}
              {target.leaveDaysPerYear} j
            </DialogDescription>
          )}
        </DialogHeader>

        {target && target.leaves.length > 0 && (
          <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
            {target.leaves.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-surface-muted"
              >
                <div>
                  <span className="font-medium text-foreground">
                    {REASON_LABELS[l.reason as keyof typeof REASON_LABELS] ?? l.reason}
                  </span>{" "}
                  <span className="text-foreground/50">
                    · {formatDate(l.startDate)} → {formatDate(l.endDate)} ({l.days} j)
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(l.id)}
                  disabled={deletingId === l.id}
                  title="Supprimer"
                  className="text-foreground/40 hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="leave-startDate">{t("settings.start")}</Label>
              <Input id="leave-startDate" type="date" {...register("startDate")} />
              {errors.startDate && (
                <p className="text-xs text-danger">{errors.startDate.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leave-endDate">Fin</Label>
              <Input id="leave-endDate" type="date" {...register("endDate")} />
              {errors.endDate && (
                <p className="text-xs text-danger">{errors.endDate.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="leave-reason">Motif</Label>
            <Select value={reason} onValueChange={(v) => setValue("reason", v as LeaveFormValues["reason"])}>
              <SelectTrigger id="leave-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_REASONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {REASON_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="leave-note">
              Note <span className="font-normal text-foreground/40">(optionnel)</span>
            </Label>
            <Input id="leave-note" {...register("note")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer le congé
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
