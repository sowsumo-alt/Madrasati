"use client";

import { useEffect, useState } from "react";
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
import { examEditSchema, TERMS, type ExamEditValues, type ExamScope } from "./schema";
import { updateExam } from "./actions";
import { ScopeChoice } from "./scope-choice";
import { useLanguage } from "@/lib/i18n/language-provider";

export interface ExamEditTarget {
  examId: string;
  className: string;
  subjectName: string;
  title: string;
  term: string;
  /** Date ISO. */
  date: string;
  durationMinutes: number | null;
  maxScore: number;
  /** Nombre de classes qui passent le même examen (1 = examen d'une seule classe). */
  classCount: number;
}

export function ExamEditDialog({
  target,
  onOpenChange,
}: {
  target: ExamEditTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [scope, setScope] = useState<ExamScope>("one");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExamEditValues>({ resolver: zodResolver(examEditSchema) });

  useEffect(() => {
    if (!target) return;
    setScope("one");
    reset({
      title: target.title,
      term: target.term as ExamEditValues["term"],
      date: target.date.slice(0, 10),
      durationMinutes: target.durationMinutes ? String(target.durationMinutes) : "",
      maxScore: target.maxScore,
    });
  }, [target, reset]);

  const term = watch("term");

  async function onSubmit(values: ExamEditValues) {
    if (!target) return;
    try {
      const { updated } = await updateExam(target.examId, values, scope);
      toast.success(
        updated > 1
          ? t("exams.updatedCount").replace("{n}", String(updated))
          : t("exams.updated"),
      );
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("exams.editTitle")}</DialogTitle>
        </DialogHeader>

        {target && (
          <p className="-mt-2 text-sm text-foreground/60">
            {target.className} · {target.subjectName}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">{t("exams.examTitle")}</Label>
            <Input id="edit-title" {...register("title")} />
            {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-term">{t("exams.term")}</Label>
              <Select
                value={term}
                onValueChange={(v) => setValue("term", v as ExamEditValues["term"])}
              >
                <SelectTrigger id="edit-term">
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
              <Label htmlFor="edit-date">{t("exams.date")}</Label>
              <Input id="edit-date" type="date" {...register("date")} />
              {errors.date && <p className="text-xs text-danger">{errors.date.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-duration">
                {t("exams.duration")}{" "}
                <span className="font-normal text-foreground/40">
                  ({t("common.optional")})
                </span>
              </Label>
              <Input id="edit-duration" type="number" min={0} {...register("durationMinutes")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-maxScore">{t("exams.maxScore")}</Label>
              <Input id="edit-maxScore" type="number" min={1} step="0.5" {...register("maxScore")} />
              {errors.maxScore && (
                <p className="text-xs text-danger">{errors.maxScore.message}</p>
              )}
            </div>
          </div>

          {/* Le choix n'apparaît que si l'examen est réellement partagé : sur
              une classe unique, la question n'a pas de sens. */}
          {target && target.classCount > 1 && (
            <ScopeChoice
              value={scope}
              onChange={setScope}
              classCount={target.classCount}
              className={target.className}
            />
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
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
