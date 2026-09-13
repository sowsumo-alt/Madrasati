"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  BookOpen,
  CalendarPlus,
  ClipboardList,
  Clock,
  FileText,
  Hash,
  Loader2,
  NotebookPen,
  Save,
  Settings2,
  Star,
  Tag,
  Timer,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSection } from "@/components/forms/form-section";
import { FormField, IconInput } from "@/components/forms/form-field";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { EXAM_KINDS, defaultTermForDate } from "@/lib/exams";
import { minutesToTime } from "@/lib/dashboard-data";
import { examSchema, TERMS, type ExamFormValues, type ExamScope } from "./schema";
import { createExam, updateExam } from "./actions";
import { ScopeChoice } from "./scope-choice";
import { ClassMultiSelect } from "./exam-form/class-multi-select";

export interface ExamClassOption {
  id: string;
  name: string;
  /** Matières de la classe, avec le coefficient appliqué sur son bulletin. */
  subjects: { id: string; name: string; coefficient: number }[];
}

export interface ExamEditTarget {
  examId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  title: string;
  kind: string | null;
  term: string;
  /** Date ISO. */
  date: string;
  startMinutes: number | null;
  durationMinutes: number | null;
  instructions: string | null;
  maxScore: number;
  coefficient: number;
  /** Nombre de classes qui passent le même examen (1 = examen d'une seule classe). */
  classCount: number;
}

const INSTRUCTIONS_MAX = 500;

const readOnlyClass = "bg-surface-muted/60 text-foreground/70";

function newExamValues(): ExamFormValues {
  return {
    classIds: [],
    subjectId: "",
    title: "",
    kind: "",
    // Proposé d'après la date du jour, puis d'après la date choisie.
    term: defaultTermForDate(new Date()),
    date: "",
    startTime: "08:00",
    durationMinutes: "60",
    instructions: "",
    maxScore: 20,
  };
}

function editValues(target: ExamEditTarget): ExamFormValues {
  return {
    classIds: [target.classId],
    subjectId: target.subjectId,
    title: target.title,
    kind: target.kind ?? "",
    term: target.term as ExamFormValues["term"],
    date: target.date.slice(0, 10),
    startTime: target.startMinutes != null ? minutesToTime(target.startMinutes) : "",
    durationMinutes: target.durationMinutes ? String(target.durationMinutes) : "",
    instructions: target.instructions ?? "",
    maxScore: target.maxScore,
  };
}

/**
 * Formulaire d'examen en trois blocs, comme sur la maquette : informations
 * générales, description et consignes, options. Il sert à la création (une ou
 * plusieurs classes) comme à la modification (classe et matière figées).
 */
export function ExamFormDialog({
  open,
  onOpenChange,
  classes,
  editTarget = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ExamClassOption[];
  editTarget?: ExamEditTarget | null;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const isEdit = Boolean(editTarget);
  const [scope, setScope] = useState<ExamScope>("one");
  // Tant que le directeur n'a pas choisi le trimestre lui-même, il suit la
  // date de l'examen.
  const [termTouched, setTermTouched] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExamFormValues>({
    resolver: zodResolver(examSchema),
    defaultValues: newExamValues(),
  });

  useEffect(() => {
    if (!open) return;
    setScope("one");
    setTermTouched(isEdit);
    reset(editTarget ? editValues(editTarget) : newExamValues());
  }, [open, editTarget, isEdit, reset]);

  const classIds = watch("classIds");
  const subjectId = watch("subjectId");
  const kind = watch("kind");
  const term = watch("term");
  const date = watch("date");
  const instructions = watch("instructions") ?? "";

  useEffect(() => {
    if (date && !termTouched) setValue("term", defaultTermForDate(date));
  }, [date, termTouched, setValue]);

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
    if (!isEdit && subjectId && !commonSubjects.some((s) => s.id === subjectId)) {
      setValue("subjectId", "");
    }
  }, [isEdit, commonSubjects, subjectId, setValue]);

  // Coefficient du bulletin : celui de la matière, dans chaque classe choisie.
  const coefficients = editTarget
    ? [editTarget.coefficient]
    : [
        ...new Set(
          classes
            .filter((c) => classIds.includes(c.id))
            .flatMap((c) => c.subjects.filter((s) => s.id === subjectId).map((s) => s.coefficient)),
        ),
      ];
  const coefficientLabel =
    coefficients.length === 0
      ? "—"
      : coefficients.length === 1
        ? String(coefficients[0])
        : t("exams.coefficientVaries");

  const subjectError =
    errors.subjectId?.message ??
    (!isEdit && classIds.length > 0 && commonSubjects.length === 0
      ? classIds.length > 1
        ? t("exams.noCommonSubject")
        : t("exams.assignSubjectsFirst")
      : undefined);

  async function onSubmit(values: ExamFormValues) {
    try {
      if (editTarget) {
        const { updated } = await updateExam(editTarget.examId, values, scope);
        toast.success(
          updated > 1
            ? t("exams.updatedCount").replace("{n}", String(updated))
            : t("exams.updated"),
        );
      } else {
        const result = await createExam(values);
        if (result.created === 0) {
          toast.info(t("exams.allAlreadyPlanned"));
        } else {
          toast.success(t("exams.scheduledCount").replace("{n}", String(result.created)));
          if (result.alreadyPlanned.length > 0) {
            toast.info(
              t("exams.alreadyPlanned").replace("{classes}", result.alreadyPlanned.join(", ")),
            );
          }
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
      <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col overflow-y-hidden p-0">
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="flex items-center gap-4 border-b border-border px-5 py-4 pe-12 sm:px-6">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 ring-4 ring-primary-50/70">
              <CalendarPlus className="h-7 w-7" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-lg">
                {isEdit ? t("exams.editTitle") : t("exams.newExam")}
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                {editTarget
                  ? `${editTarget.className} · ${editTarget.subjectName}`
                  : t("exams.newDescription")}
              </DialogDescription>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface-muted/30 px-5 py-5 sm:px-6">
            <FormSection icon={ClipboardList} title={t("exams.sectionGeneral")}>
              <FormField label={t("exams.name")} htmlFor="exam-title" required error={errors.title?.message}>
                <IconInput
                  icon={NotebookPen}
                  id="exam-title"
                  placeholder={t("exams.titlePlaceholder")}
                  {...register("title")}
                />
              </FormField>

              <FormField
                label={t("students.class")}
                htmlFor="exam-classes"
                required
                error={errors.classIds?.message}
                hint={!isEdit && classIds.length > 1 ? t("exams.multiClassHint") : undefined}
              >
                {editTarget ? (
                  <IconInput
                    icon={Users}
                    id="exam-classes"
                    value={editTarget.className}
                    readOnly
                    tabIndex={-1}
                    className={readOnlyClass}
                  />
                ) : (
                  <ClassMultiSelect
                    id="exam-classes"
                    classes={classes}
                    value={classIds}
                    onChange={(ids) => setValue("classIds", ids, { shouldValidate: true })}
                    placeholder={t("students.selectClass")}
                    selectAllLabel={t("exams.selectAllClasses")}
                    clearLabel={t("exams.deselectAll")}
                    emptyLabel={t("exams.noClass")}
                    countLabel={t("exams.classesCount")}
                  />
                )}
              </FormField>

              <FormField label={t("teachers.subject")} htmlFor="exam-subject" required error={subjectError}>
                {editTarget ? (
                  <IconInput
                    icon={BookOpen}
                    id="exam-subject"
                    value={editTarget.subjectName}
                    readOnly
                    tabIndex={-1}
                    className={readOnlyClass}
                  />
                ) : (
                  <Select
                    value={subjectId || undefined}
                    onValueChange={(v) => setValue("subjectId", v, { shouldValidate: true })}
                    disabled={commonSubjects.length === 0}
                  >
                    <SelectTrigger id="exam-subject">
                      <span className="flex min-w-0 items-center gap-2">
                        <BookOpen className="h-4 w-4 shrink-0 text-foreground/40" />
                        <SelectValue placeholder={t("exams.selectSubject")}>
                          {commonSubjects.find((s) => s.id === subjectId)?.name}
                        </SelectValue>
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {commonSubjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              <FormField label={t("exams.kind")} htmlFor="exam-kind" required error={errors.kind?.message}>
                <Select value={kind || undefined} onValueChange={(v) => setValue("kind", v, { shouldValidate: true })}>
                  <SelectTrigger id="exam-kind">
                    <span className="flex min-w-0 items-center gap-2">
                      <Tag className="h-4 w-4 shrink-0 text-foreground/40" />
                      <SelectValue placeholder={t("exams.selectKind")}>
                        {kind ? t(`exams.kind.${kind}` as TranslationKey) : undefined}
                      </SelectValue>
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {EXAM_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {t(`exams.kind.${k}` as TranslationKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:col-span-2 sm:grid-cols-3">
                <FormField label={t("exams.examDate")} htmlFor="exam-date" required error={errors.date?.message}>
                  <DateInput id="exam-date" {...register("date")} />
                </FormField>
                <FormField label={t("exams.startTime")} htmlFor="exam-start" required error={errors.startTime?.message}>
                  <IconInput icon={Clock} id="exam-start" type="time" {...register("startTime")} />
                </FormField>
                <FormField
                  label={t("exams.durationMinutes")}
                  htmlFor="exam-duration"
                  required
                  error={errors.durationMinutes?.message}
                >
                  <IconInput
                    icon={Timer}
                    id="exam-duration"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    {...register("durationMinutes")}
                  />
                </FormField>
              </div>
            </FormSection>

            <FormSection icon={FileText} title={t("exams.sectionInstructions")} bodyClassName="sm:grid-cols-1">
              <div className="space-y-1">
                <textarea
                  id="exam-instructions"
                  rows={3}
                  maxLength={INSTRUCTIONS_MAX}
                  placeholder={t("exams.instructionsPlaceholder")}
                  aria-label={t("exams.sectionInstructions")}
                  className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  {...register("instructions")}
                />
                <div className="flex justify-between gap-3 text-xs">
                  <span className="text-danger">{errors.instructions?.message}</span>
                  <span className="text-foreground/40" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {instructions.length}/{INSTRUCTIONS_MAX}
                  </span>
                </div>
              </div>
            </FormSection>

            <FormSection icon={Settings2} title={t("exams.sectionOptions")} bodyClassName="sm:grid-cols-3">
              <FormField label={t("exams.maxScore")} htmlFor="exam-max" required error={errors.maxScore?.message}>
                <IconInput icon={Star} id="exam-max" type="number" min={1} step="0.5" {...register("maxScore")} />
              </FormField>
              <FormField label={t("exams.term")} htmlFor="exam-term" required>
                <Select
                  value={term}
                  onValueChange={(v) => {
                    setTermTouched(true);
                    setValue("term", v as ExamFormValues["term"]);
                  }}
                >
                  <SelectTrigger id="exam-term">
                    <SelectValue>{term}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TERMS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t("exams.coefficient")} htmlFor="exam-coefficient" hint={t("exams.coefficientHint")}>
                {/* Lecture seule : c'est le coefficient de la matière qui compte
                    dans les bulletins, pas un réglage propre à cet examen. */}
                <IconInput
                  icon={Hash}
                  id="exam-coefficient"
                  value={coefficientLabel}
                  readOnly
                  tabIndex={-1}
                  className={readOnlyClass}
                />
              </FormField>
            </FormSection>

            {/* Le choix n'apparaît que si l'examen est réellement partagé : sur
                une classe unique, la question n'a pas de sens. */}
            {editTarget && editTarget.classCount > 1 && (
              <ScopeChoice
                value={scope}
                onChange={setScope}
                classCount={editTarget.classCount}
                className={editTarget.className}
              />
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Button type="button" variant="secondary" className="sm:min-w-28" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="sm:min-w-36">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {!isEdit && classIds.length > 1
                ? t("exams.scheduleForCount").replace("{n}", String(classIds.length))
                : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
