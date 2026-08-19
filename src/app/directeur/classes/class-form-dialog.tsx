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
import { classSchema, type ClassFormValues } from "./schema";
import { createClass, updateClass } from "./actions";
import { useLanguage } from "@/lib/i18n/language-provider";

export interface ClassTeacherOption {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ClassEditTarget {
  id: string;
  name: string;
  level: string;
  capacity: number;
  mainTeacherId: string | null;
}

interface ClassFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teachers: ClassTeacherOption[];
  editTarget?: ClassEditTarget | null;
}

const emptyValues: ClassFormValues = {
  name: "",
  level: "",
  capacity: 30,
  mainTeacherId: "",
};

export function ClassFormDialog({
  open,
  onOpenChange,
  teachers,
  editTarget,
}: ClassFormDialogProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const isEdit = Boolean(editTarget);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormValues>({
    resolver: zodResolver(classSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (open) {
      reset(
        editTarget
          ? {
              name: editTarget.name,
              level: editTarget.level,
              capacity: editTarget.capacity,
              mainTeacherId: editTarget.mainTeacherId ?? "",
            }
          : emptyValues,
      );
    }
  }, [open, editTarget, reset]);

  async function onSubmit(values: ClassFormValues) {
    try {
      if (isEdit && editTarget) {
        await updateClass(editTarget.id, values);
        toast.success(t("classes.updated"));
      } else {
        await createClass(values);
        toast.success(t("classes.created"));
      }
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  const mainTeacherId = watch("mainTeacherId");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la classe" : "Nouvelle classe"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("classes.name")}</Label>
              <Input id="name" placeholder="6AF" {...register("name")} />
              {errors.name && (
                <p className="text-xs text-danger">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="level">Niveau</Label>
              <Input id="level" placeholder="6AF" {...register("level")} />
              {errors.level && (
                <p className="text-xs text-danger">{errors.level.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="capacity">{t("classes.capacity")}</Label>
              <Input id="capacity" type="number" min={1} {...register("capacity")} />
              {errors.capacity && (
                <p className="text-xs text-danger">{errors.capacity.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="class-main-teacher-select">Professeur principal</Label>
              <Select
                value={mainTeacherId || "none"}
                onValueChange={(v) => setValue("mainTeacherId", v === "none" ? "" : v)}
              >
                <SelectTrigger id="class-main-teacher-select">
                  <SelectValue placeholder={t("common.none")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common.none")}</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
