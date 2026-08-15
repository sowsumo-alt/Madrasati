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
import { teacherSchema, type TeacherFormValues } from "./schema";
import { createTeacher, updateTeacher } from "./actions";

export interface TeacherEditTarget {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  diploma: string | null;
  subjectSpecialty: string | null;
  monthlySalary: number | null;
  hireDate: string | null;
  status: string;
}

interface TeacherFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: string[];
  editTarget?: TeacherEditTarget | null;
}

const emptyValues: TeacherFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  diploma: "",
  subjectSpecialty: "",
  monthlySalary: "",
  hireDate: "",
  status: "ACTIVE",
};

export function TeacherFormDialog({
  open,
  onOpenChange,
  subjects,
  editTarget,
}: TeacherFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(editTarget);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (open) {
      reset(
        editTarget
          ? {
              firstName: editTarget.firstName,
              lastName: editTarget.lastName,
              phone: editTarget.phone,
              email: editTarget.email ?? "",
              diploma: editTarget.diploma ?? "",
              subjectSpecialty: editTarget.subjectSpecialty ?? "",
              monthlySalary:
                editTarget.monthlySalary != null ? String(editTarget.monthlySalary) : "",
              hireDate: editTarget.hireDate ?? "",
              status: editTarget.status as TeacherFormValues["status"],
            }
          : emptyValues,
      );
    }
  }, [open, editTarget, reset]);

  async function onSubmit(values: TeacherFormValues) {
    try {
      if (isEdit && editTarget) {
        await updateTeacher(editTarget.id, values);
        toast.success("Enseignant modifié avec succès.");
      } else {
        await createTeacher(values);
        toast.success("Enseignant ajouté avec succès.");
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    }
  }

  const subjectSpecialty = watch("subjectSpecialty");
  const status = watch("status");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier l'enseignant" : "Nouvel enseignant"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Prénom</Label>
              <Input id="firstName" {...register("firstName")} />
              {errors.firstName && (
                <p className="text-xs text-danger">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Nom de famille</Label>
              <Input id="lastName" {...register("lastName")} />
              {errors.lastName && (
                <p className="text-xs text-danger">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Téléphone (WhatsApp)</Label>
              <Input id="phone" placeholder="+222 XX XX XX XX" {...register("phone")} />
              {errors.phone && (
                <p className="text-xs text-danger">{errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">
                Email <span className="font-normal text-foreground/40">(optionnel)</span>
              </Label>
              <Input id="email" type="email" {...register("email")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="teacher-subject-select">Matière enseignée</Label>
              <Select
                value={subjectSpecialty || undefined}
                onValueChange={(v) => setValue("subjectSpecialty", v)}
              >
                <SelectTrigger id="teacher-subject-select">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="diploma">
                Diplôme <span className="font-normal text-foreground/40">(optionnel)</span>
              </Label>
              <Input id="diploma" placeholder="Licence, Master…" {...register("diploma")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="monthlySalary">
                Salaire mensuel (MRU){" "}
                <span className="font-normal text-foreground/40">(optionnel)</span>
              </Label>
              <Input
                id="monthlySalary"
                type="number"
                min={0}
                {...register("monthlySalary")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hireDate">
                Date d&apos;embauche{" "}
                <span className="font-normal text-foreground/40">(optionnel)</span>
              </Label>
              <Input id="hireDate" type="date" {...register("hireDate")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="teacher-status-select">Statut</Label>
            <Select
              value={status}
              onValueChange={(v) => setValue("status", v as TeacherFormValues["status"])}
            >
              <SelectTrigger id="teacher-status-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Actif</SelectItem>
                <SelectItem value="INACTIVE">Inactif</SelectItem>
              </SelectContent>
            </Select>
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
