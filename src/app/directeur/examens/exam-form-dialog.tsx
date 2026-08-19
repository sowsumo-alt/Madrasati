"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
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
import { examSchema, TERMS, type ExamFormValues } from "./schema";
import { createExam } from "./actions";
import { useLanguage } from "@/lib/i18n/language-provider";

export interface ExamClassOption {
  id: string;
  name: string;
  subjects: { id: string; name: string }[];
}

interface ExamFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ExamClassOption[];
}

const emptyValues: ExamFormValues = {
  classIds: [],
  subjectId: "",
  title: "",
  term: "Trimestre 1",
  date: "",
  durationMinutes: "",
  maxScore: 20,
};

export function ExamFormDialog({ open, onOpenChange, classes }: ExamFormDialogProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExamFormValues>({
    resolver: zodResolver(examSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (open) reset(emptyValues);
  }, [open, reset]);

  const classIds = watch("classIds");
  const subjectId = watch("subjectId");
  const term = watch("term");

  /**
   * Matières proposées : celles enseignées dans **toutes** les classes
   * cochées. Une matière absente d'une seule d'entre elles rendrait l'examen
   * impossible à créer pour celle-là, et le serveur refuserait l'ensemble ;
   * mieux vaut ne pas la proposer du tout.
   */
  const commonSubjects = useMemo(() => {
    const selected = classes.filter((c) => classIds.includes(c.id));
    if (selected.length === 0) return [];
    return selected[0].subjects.filter((s) =>
      selected.every((c) => c.subjects.some((cs) => cs.id === s.id)),
    );
  }, [classes, classIds]);

  // Une matière déjà choisie qui disparaît de l'intersection (le directeur
  // vient de cocher une classe qui ne l'enseigne pas) est retirée, sinon le
  // formulaire garderait une valeur invisible et incohérente.
  useEffect(() => {
    if (subjectId && !commonSubjects.some((s) => s.id === subjectId)) {
      setValue("subjectId", "");
    }
  }, [commonSubjects, subjectId, setValue]);

  const allSelected = classes.length > 0 && classIds.length === classes.length;

  function toggleClass(id: string) {
    setValue(
      "classIds",
      classIds.includes(id) ? classIds.filter((c) => c !== id) : [...classIds, id],
      { shouldValidate: true },
    );
  }

  async function onSubmit(values: ExamFormValues) {
    try {
      const result = await createExam(values);
      if (result.created === 0) {
        toast.info(t("exams.allAlreadyPlanned"));
      } else {
        toast.success(
          t("exams.scheduledCount").replace("{n}", String(result.created)),
        );
        if (result.alreadyPlanned.length > 0) {
          toast.info(
            t("exams.alreadyPlanned").replace("{classes}", result.alreadyPlanned.join(", ")),
          );
        }
      }
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("exams.newExam")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>
                {t("exams.classes")}{" "}
                {classIds.length > 0 && (
                  <span className="font-normal text-foreground/40">
                    ({classIds.length})
                  </span>
                )}
              </Label>
              <button
                type="button"
                onClick={() =>
                  setValue("classIds", allSelected ? [] : classes.map((c) => c.id), {
                    shouldValidate: true,
                  })
                }
                className="text-xs font-medium text-primary-600 hover:underline"
              >
                {allSelected ? t("exams.deselectAll") : t("exams.selectAllClasses")}
              </button>
            </div>
            <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1.5">
              {classes.length === 0 ? (
                <p className="px-2 py-3 text-xs text-foreground/50">
                  {t("exams.noClass")}
                </p>
              ) : (
                classes.map((c) => {
                  const checked = classIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleClass(c.id)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-muted"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? "border-primary-700 bg-primary-700 text-white"
                            : "border-border"
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className={checked ? "text-foreground" : "text-foreground/70"}>
                        {c.name}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            {errors.classIds && (
              <p className="text-xs text-danger">{errors.classIds.message}</p>
            )}
            <p className="text-xs text-foreground/50">{t("exams.multiClassHint")}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exam-subject-select">{t("teachers.subject")}</Label>
            <Select
              value={subjectId || undefined}
              onValueChange={(v) => setValue("subjectId", v, { shouldValidate: true })}
              disabled={commonSubjects.length === 0}
            >
              <SelectTrigger id="exam-subject-select">
                <SelectValue placeholder={t("students.selectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {commonSubjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.subjectId && (
              <p className="text-xs text-danger">{errors.subjectId.message}</p>
            )}
            {classIds.length > 0 && commonSubjects.length === 0 && (
              <p className="text-xs text-foreground/50">
                {classIds.length > 1
                  ? t("exams.noCommonSubject")
                  : t("exams.assignSubjectsFirst")}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">{t("exams.examTitle")}</Label>
            <Input id="title" placeholder={t("exams.titlePlaceholder")} {...register("title")} />
            {errors.title && (
              <p className="text-xs text-danger">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exam-term-select">{t("exams.term")}</Label>
              <Select
                value={term}
                onValueChange={(v) => setValue("term", v as ExamFormValues["term"])}
              >
                <SelectTrigger id="exam-term-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERMS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date">{t("exams.date")}</Label>
              <Input id="date" type="date" {...register("date")} />
              {errors.date && (
                <p className="text-xs text-danger">{errors.date.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="durationMinutes">
                {t("exams.duration")}{" "}
                <span className="font-normal text-foreground/40">
                  ({t("common.optional")})
                </span>
              </Label>
              <Input id="durationMinutes" type="number" min={0} {...register("durationMinutes")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxScore">{t("exams.maxScore")}</Label>
              <Input id="maxScore" type="number" min={1} step="0.5" {...register("maxScore")} />
              {errors.maxScore && (
                <p className="text-xs text-danger">{errors.maxScore.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {classIds.length > 1
                ? t("exams.scheduleForCount").replace("{n}", String(classIds.length))
                : t("exams.schedule")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
