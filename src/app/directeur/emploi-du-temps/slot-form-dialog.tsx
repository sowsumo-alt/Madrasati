"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { BookOpen, CalendarDays, CalendarPlus, Clock, Loader2, MapPin, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSection } from "@/components/forms/form-section";
import { FormField, IconInput } from "@/components/forms/form-field";
import { formatDateIn } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-provider";
import { slotSchema, type SlotFormValues } from "./schema";
import { createSlot } from "./actions";

export interface SlotSubjectOption {
  id: string;
  subjectName: string;
  teacherId: string | null;
  teacherName: string | null;
}

const SCHOOL_DAYS = [1, 2, 3, 4, 5];

interface SlotFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  classSubjects: SlotSubjectOption[];
  /** Jour et horaires préremplis — ceux de la case cliquée dans la grille. */
  defaultDay?: number;
  defaultStart?: string;
  defaultEnd?: string;
}

/** Ajout d'un cours à l'emploi du temps d'une classe. */
export function SlotFormDialog({
  open,
  onOpenChange,
  classId,
  className,
  classSubjects,
  defaultDay = 1,
  defaultStart = "08:00",
  defaultEnd = "09:00",
}: SlotFormDialogProps) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SlotFormValues>({
    resolver: zodResolver(slotSchema),
    defaultValues: {
      classId,
      classSubjectId: "",
      dayOfWeek: defaultDay,
      startTime: defaultStart,
      endTime: defaultEnd,
      room: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        classId,
        classSubjectId: "",
        dayOfWeek: defaultDay,
        startTime: defaultStart,
        endTime: defaultEnd,
        room: "",
      });
    }
  }, [open, classId, defaultDay, defaultStart, defaultEnd, reset]);

  async function onSubmit(values: SlotFormValues) {
    try {
      await createSlot(values);
      toast.success(t("schedule.slotAdded"));
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      // Le serveur explique les conflits (enseignant ou salle déjà occupés) :
      // son message est affiché tel quel.
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  const dayOfWeek = watch("dayOfWeek");
  const classSubjectId = watch("classSubjectId");
  const selected = classSubjects.find((cs) => cs.id === classSubjectId);
  // Le 1er janvier 2024 est un lundi : noms des jours dans la langue de l'interface.
  const dayLabel = (day: number) =>
    formatDateIn(locale, new Date(Date.UTC(2024, 0, day)), { weekday: "long" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-xl flex-col overflow-y-hidden p-0">
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="flex items-center gap-4 border-b border-border px-5 py-4 pe-12 sm:px-6">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 ring-4 ring-primary-50/70">
              <CalendarPlus className="h-7 w-7" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-lg">{t("schedule.newCourse")}</DialogTitle>
              <DialogDescription className="mt-0.5">
                {t("schedule.newCourseDescription").replace("{class}", className)}
              </DialogDescription>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted/30 px-5 py-5 sm:px-6">
            <FormSection icon={BookOpen} title={t("schedule.courseSection")}>
              <FormField
                label={t("schedule.subjectAndTeacher")}
                htmlFor="slot-subject"
                required
                error={errors.classSubjectId?.message}
                className="sm:col-span-2"
              >
                <Select
                  value={classSubjectId || undefined}
                  onValueChange={(v) => setValue("classSubjectId", v, { shouldValidate: true })}
                >
                  <SelectTrigger id="slot-subject">
                    <span className="flex min-w-0 items-center gap-2">
                      <BookOpen className="h-4 w-4 shrink-0 text-foreground/40" />
                      <SelectValue placeholder={t("students.selectPlaceholder")}>
                        {selected
                          ? `${selected.subjectName}${selected.teacherName ? ` — ${selected.teacherName}` : ""}`
                          : undefined}
                      </SelectValue>
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {classSubjects.map((cs) => (
                      <SelectItem key={cs.id} value={cs.id}>
                        {cs.subjectName}
                        {cs.teacherName ? ` — ${cs.teacherName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label={t("schedule.day")} htmlFor="slot-day" required>
                <Select value={String(dayOfWeek)} onValueChange={(v) => setValue("dayOfWeek", Number(v))}>
                  <SelectTrigger id="slot-day">
                    <span className="flex min-w-0 items-center gap-2 capitalize">
                      <CalendarDays className="h-4 w-4 shrink-0 text-foreground/40" />
                      <SelectValue>{dayLabel(Number(dayOfWeek))}</SelectValue>
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {SCHOOL_DAYS.map((d) => (
                      <SelectItem key={d} value={String(d)} className="capitalize">
                        {dayLabel(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label={t("dashboard.room")} htmlFor="slot-room" hint={t("common.optional")}>
                <IconInput
                  icon={MapPin}
                  id="slot-room"
                  placeholder={t("schedule.roomPlaceholder")}
                  {...register("room")}
                />
              </FormField>

              <FormField label={t("settings.start")} htmlFor="slot-start" required error={errors.startTime?.message}>
                <IconInput icon={Clock} id="slot-start" type="time" {...register("startTime")} />
              </FormField>

              <FormField label={t("schedule.end")} htmlFor="slot-end" required error={errors.endTime?.message}>
                <IconInput icon={Clock} id="slot-end" type="time" {...register("endTime")} />
              </FormField>
            </FormSection>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Button type="button" variant="secondary" className="sm:min-w-28" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="sm:min-w-36">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("common.add")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
