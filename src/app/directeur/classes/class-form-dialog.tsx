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
import { ClassLevelPicker } from "@/components/classes/class-level-picker";
import { classCategory, sectionOf, type CatalogGroup } from "@/lib/class-catalog";

export interface ClassTeacherOption {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ClassEditTarget {
  id: string;
  name: string;
  level: string;
  category: string | null;
  capacity: number;
  mainTeacherId: string | null;
}

interface ClassFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teachers: ClassTeacherOption[];
  /** Catégories et niveaux proposés (voir buildCatalog). */
  catalog: CatalogGroup[];
  /** Noms des classes de l'année, pour nommer la nouvelle classe. */
  existingNames: string[];
  editTarget?: ClassEditTarget | null;
}

const emptyValues: ClassFormValues = {
  category: "",
  level: "",
  section: "",
  mainTeacherId: "",
};

export function ClassFormDialog({
  open,
  onOpenChange,
  teachers,
  catalog,
  existingNames,
  editTarget,
}: ClassFormDialogProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const isEdit = Boolean(editTarget);
  const {
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
              category: classCategory(editTarget) ?? "",
              level: editTarget.level,
              section: sectionOf(editTarget.name, editTarget.level),
              mainTeacherId: editTarget.mainTeacherId ?? "",
            }
          : emptyValues,
      );
    }
  }, [open, editTarget, reset]);

  async function onSubmit(values: ClassFormValues) {
    try {
      if (isEdit && editTarget) {
        const updated = await updateClass(editTarget.id, values);
        if (!updated.ok) {
          toast.error(updated.error);
          return;
        }
        toast.success(t("classes.updated"));
      } else {
        const created = await createClass(values);
        if (!created.ok) {
          toast.error(created.error);
          return;
        }
        toast.success(
          created.subjectsFrom === "copied"
            ? `Classe « ${created.name} » créée, avec les matières et coefficients de son niveau.`
            : created.subjectsFrom === "template"
              ? `Classe « ${created.name} » créée, avec les matières et coefficients de sa catégorie.`
              : `Classe « ${created.name} » créée.`,
        );
      }
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  const mainTeacherId = watch("mainTeacherId");
  const [category, level, section] = watch(["category", "level", "section"]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("classes.editClass") : t("classes.newClass")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {open && (
            <ClassLevelPicker
              key={editTarget?.id ?? "new"}
              catalog={catalog}
              takenNames={isEdit ? undefined : existingNames}
              value={{ category: category ?? "", level: level ?? "", section: section ?? "" }}
              onChange={(v) => {
                setValue("category", v.category, { shouldValidate: Boolean(errors.category) });
                setValue("level", v.level, { shouldValidate: Boolean(errors.level) });
                setValue("section", v.section);
              }}
            />
          )}
          {(errors.category || errors.level) && (
            <p className="text-xs text-danger">
              {errors.category?.message ?? errors.level?.message}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
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
