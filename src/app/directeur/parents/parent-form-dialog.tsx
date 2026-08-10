"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
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
import { parentSchema, type ParentFormValues } from "./schema";
import { createParent, updateParent } from "./actions";

export interface ParentStudentOption {
  id: string;
  firstName: string;
  lastName: string;
  className: string | null;
}

export interface ParentEditTarget {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  address: string | null;
  relationship: string | null;
  studentIds: string[];
}

interface ParentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: ParentStudentOption[];
  editTarget?: ParentEditTarget | null;
}

const emptyValues: ParentFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  address: "",
  relationship: "",
  studentIds: [],
};

export function ParentFormDialog({
  open,
  onOpenChange,
  students,
  editTarget,
}: ParentFormDialogProps) {
  const router = useRouter();
  const isEdit = Boolean(editTarget);
  const [studentQuery, setStudentQuery] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ParentFormValues>({
    resolver: zodResolver(parentSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (open) {
      setStudentQuery("");
      reset(
        editTarget
          ? {
              firstName: editTarget.firstName,
              lastName: editTarget.lastName,
              phone: editTarget.phone,
              email: editTarget.email ?? "",
              address: editTarget.address ?? "",
              relationship: editTarget.relationship ?? "",
              studentIds: editTarget.studentIds,
            }
          : emptyValues,
      );
    }
  }, [open, editTarget, reset]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q),
    );
  }, [students, studentQuery]);

  async function onSubmit(values: ParentFormValues) {
    try {
      if (isEdit && editTarget) {
        await updateParent(editTarget.id, values);
        toast.success("Parent modifié avec succès.");
      } else {
        await createParent(values);
        toast.success("Parent ajouté avec succès.");
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le parent" : "Nouveau parent"}</DialogTitle>
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
              <Label htmlFor="lastName">Nom</Label>
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
              <Label htmlFor="relationship">
                Lien <span className="font-normal text-foreground/40">(optionnel)</span>
              </Label>
              <Input id="relationship" placeholder="père, mère, tuteur…" {...register("relationship")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">
                Email <span className="font-normal text-foreground/40">(optionnel)</span>
              </Label>
              <Input id="email" type="email" {...register("email")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">
                Adresse <span className="font-normal text-foreground/40">(optionnel)</span>
              </Label>
              <Input id="address" {...register("address")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Enfant(s) lié(s)</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <Input
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Rechercher un élève…"
                className="pl-9"
              />
            </div>
            <Controller
              control={control}
              name="studentIds"
              render={({ field }) => (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-border">
                  {filteredStudents.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-foreground/40">
                      Aucun élève trouvé.
                    </p>
                  ) : (
                    filteredStudents.map((s) => {
                      const checked = field.value.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0 hover:bg-surface-muted"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              field.onChange(
                                e.target.checked
                                  ? [...field.value, s.id]
                                  : field.value.filter((id) => id !== s.id),
                              );
                            }}
                            className="h-4 w-4 rounded border-border text-primary-700 focus:ring-primary-500"
                          />
                          <span className="text-foreground">
                            {s.firstName} {s.lastName}
                          </span>
                          {s.className && (
                            <span className="text-xs text-foreground/40">
                              {s.className}
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            />
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
