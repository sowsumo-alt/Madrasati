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
      toast.success("Frais ajouté avec succès.");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    }
  }

  const studentId = watch("studentId");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau frais</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label>Élève</Label>
            <Select
              value={studentId || undefined}
              onValueChange={(v) => setValue("studentId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un élève" />
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
            <Label htmlFor="label">Libellé</Label>
            <Input
              id="label"
              placeholder="Frais de scolarité — Trimestre 1"
              {...register("label")}
            />
            {errors.label && (
              <p className="text-xs text-danger">{errors.label.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Montant (MRU)</Label>
              <Input id="amount" type="number" min={0} {...register("amount")} />
              {errors.amount && (
                <p className="text-xs text-danger">{errors.amount.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Échéance</Label>
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
