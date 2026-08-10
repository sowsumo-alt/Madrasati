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
import { studentSchema, type StudentFormValues } from "./schema";
import { createStudent, updateStudent } from "./actions";

export interface StudentClassOption {
  id: string;
  name: string;
}

export interface StudentEditTarget {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  classId: string | null;
  status: string;
  parentFirstName?: string;
  parentLastName?: string;
  parentPhone?: string;
}

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: StudentClassOption[];
  editTarget?: StudentEditTarget | null;
}

const emptyValues: StudentFormValues = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  classId: "",
  status: "ACTIVE",
  parentFirstName: "",
  parentLastName: "",
  parentPhone: "",
};

export function StudentFormDialog({
  open,
  onOpenChange,
  classes,
  editTarget,
}: StudentFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(editTarget);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (open) {
      reset(
        editTarget
          ? {
              firstName: editTarget.firstName,
              lastName: editTarget.lastName,
              dateOfBirth: editTarget.dateOfBirth ?? "",
              gender: (editTarget.gender as "M" | "F" | "") ?? "",
              classId: editTarget.classId ?? "",
              status: editTarget.status as StudentFormValues["status"],
              parentFirstName: editTarget.parentFirstName ?? "",
              parentLastName: editTarget.parentLastName ?? "",
              parentPhone: editTarget.parentPhone ?? "",
            }
          : emptyValues,
      );
    }
  }, [open, editTarget, reset]);

  async function onSubmit(values: StudentFormValues) {
    try {
      if (isEdit && editTarget) {
        await updateStudent(editTarget.id, values);
        toast.success("Élève modifié avec succès.");
      } else {
        await createStudent(values);
        toast.success("Élève ajouté avec succès.");
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    }
  }

  const classId = watch("classId");
  const gender = watch("gender");
  const status = watch("status");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'élève" : "Nouvel élève"}</DialogTitle>
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
              <Label htmlFor="dateOfBirth">Date de naissance</Label>
              <Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
            </div>
            <div className="space-y-1.5">
              <Label>Genre</Label>
              <Select
                value={gender || undefined}
                onValueChange={(v) => setValue("gender", v as "M" | "F")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculin</SelectItem>
                  <SelectItem value="F">Féminin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Classe</Label>
              <Select
                value={classId || "none"}
                onValueChange={(v) => setValue("classId", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sans classe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sans classe</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select
                value={status}
                onValueChange={(v) =>
                  setValue("status", v as StudentFormValues["status"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Actif</SelectItem>
                  <SelectItem value="INACTIVE">Inactif</SelectItem>
                  <SelectItem value="TRANSFERRED">Transféré</SelectItem>
                  <SelectItem value="GRADUATED">Diplômé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm font-medium text-foreground/80">
              Parent / tuteur <span className="font-normal text-foreground/40">(optionnel)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="parentFirstName">Prénom</Label>
                <Input id="parentFirstName" {...register("parentFirstName")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="parentLastName">Nom</Label>
                <Input id="parentLastName" {...register("parentLastName")} />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="parentPhone">Téléphone (WhatsApp)</Label>
              <Input
                id="parentPhone"
                placeholder="+222 XX XX XX XX"
                {...register("parentPhone")}
              />
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
