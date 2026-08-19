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
import { subjectSchema, type SubjectFormValues } from "./schema";
import { createSubject, updateSubject } from "./actions";
import { useLanguage } from "@/lib/i18n/language-provider";

export interface SubjectEditTarget {
  id: string;
  name: string;
  nameAr: string | null;
  coefficient: number;
}

interface SubjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTarget?: SubjectEditTarget | null;
}

const emptyValues: SubjectFormValues = { name: "", nameAr: "", coefficient: 1 };

export function SubjectFormDialog({ open, onOpenChange, editTarget }: SubjectFormDialogProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const isEdit = Boolean(editTarget);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (open) {
      reset(
        editTarget
          ? {
              name: editTarget.name,
              nameAr: editTarget.nameAr ?? "",
              coefficient: editTarget.coefficient,
            }
          : emptyValues,
      );
    }
  }, [open, editTarget, reset]);

  async function onSubmit(values: SubjectFormValues) {
    try {
      if (isEdit && editTarget) {
        await updateSubject(editTarget.id, values);
        toast.success(t("classes.subjectUpdated"));
      } else {
        await createSubject(values);
        toast.success(t("classes.subjectCreated"));
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(t("common.retryError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la matière" : "Nouvelle matière"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-danger">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nameAr">
              Nom en arabe{" "}
              <span className="font-normal text-foreground/40">(optionnel)</span>
            </Label>
            <Input
              id="nameAr"
              dir="rtl"
              lang="ar"
              placeholder="الرياضيات"
              {...register("nameAr")}
            />
            <p className="text-xs text-foreground/40">{t("classes.subjectArabicHint")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coefficient">Coefficient</Label>
            <Input id="coefficient" type="number" min={1} {...register("coefficient")} />
            {errors.coefficient && (
              <p className="text-xs text-danger">{errors.coefficient.message}</p>
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
