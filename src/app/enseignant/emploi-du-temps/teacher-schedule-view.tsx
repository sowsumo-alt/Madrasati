"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  TeacherSlotFormDialog,
  type TeacherClassSubjectOption,
} from "./teacher-slot-form-dialog";
import { deleteTeacherSlot } from "./actions";
import { useLanguage } from "@/lib/i18n/language-provider";

const DAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
];

export interface TeacherScheduleSlot {
  id: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  room: string | null;
  subjectName: string;
  className: string;
}

function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function TeacherScheduleView({
  slots,
  classSubjects,
  schoolName,
  teacherName,
}: {
  slots: TeacherScheduleSlot[];
  classSubjects: TeacherClassSubjectOption[];
  schoolName: string;
  teacherName: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<TeacherScheduleSlot | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  async function handleDelete() {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      await deleteTeacherSlot(confirmTarget.id);
      toast.success(t("schedule.courseRemoved"));
      setConfirmTarget(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("schedule.myTitle")}</h1>
          <p className="mt-1 text-sm text-foreground/60">{t("schedule.mySubtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />{t("schedule.addCourse")}</Button>
          <PrintButton label={t("common.print")} />
        </div>
      </div>

      <p className="hidden text-center text-lg font-semibold text-foreground print:block">
        {schoolName} — Emploi du temps — {teacherName}
      </p>

      {slots.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-16 text-center text-sm text-foreground/50">{t("schedule.noCourse")}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {DAYS.map((day) => {
            const daySlots = slots.filter((s) => s.dayOfWeek === day.value);
            return (
              <div key={day.value} className="rounded-xl border border-border bg-surface p-3">
                <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-foreground/50">
                  {day.label}
                </p>
                {daySlots.length === 0 ? (
                  <p className="py-6 text-center text-xs text-foreground/30">—</p>
                ) : (
                  <div className="space-y-2">
                    {daySlots.map((s) => (
                      <div
                        key={s.id}
                        className="group relative rounded-lg bg-primary-50 px-2.5 py-2"
                      >
                        <button
                          onClick={() => setConfirmTarget(s)}
                          title={t("schedule.removeCourse")}
                          className="no-print absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-primary-700/50 opacity-0 transition-opacity hover:bg-primary-100 hover:text-danger group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <p className="text-xs font-medium text-primary-800">
                          {minutesToTime(s.startMinutes)} – {minutesToTime(s.endMinutes)}
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-foreground">
                          {s.subjectName}
                        </p>
                        <p className="text-xs text-foreground/60">{s.className}</p>
                        {s.room && (
                          <p className="text-xs text-foreground/40">Salle {s.room}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TeacherSlotFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        classSubjects={classSubjects}
      />
      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={t("schedule.removeCourseTitle")}
        description="Ce créneau sera supprimé de votre emploi du temps."
        confirmLabel="Retirer"
        variant="danger"
        loading={confirmLoading}
        onConfirm={handleDelete}
      />
    </div>
  );
}
