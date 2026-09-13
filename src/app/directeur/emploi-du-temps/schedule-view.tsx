"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, ChevronRight, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PrintButton } from "@/components/ui/print-button";
import { PdfButton } from "@/components/ui/pdf-button";
import { startOfWeek } from "@/lib/dashboard-data";
import { useLanguage } from "@/lib/i18n/language-provider";
import { SlotFormDialog, type SlotSubjectOption } from "./slot-form-dialog";
import { deleteSlot } from "./actions";
import { ScheduleFilters, type ScheduleViewMode } from "./schedule/schedule-filters";
import { WeekGrid } from "./schedule/week-grid";
import { MonthCalendar } from "./schedule/month-calendar";

export interface ScheduleYearOption {
  id: string;
  label: string;
  isCurrent: boolean;
}

export interface ScheduleClassOption {
  id: string;
  name: string;
  academicYearId: string;
  classSubjects: SlotSubjectOption[];
}

export interface SlotRow {
  id: string;
  classId: string;
  className: string;
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  room: string | null;
  subjectName: string;
  teacherId: string | null;
  teacherName: string | null;
}

/** Examen ou jour férié placé sur le calendrier. */
export interface ScheduleEvent {
  id: string;
  /** Jour ISO, ex. "2026-09-15". */
  day: string;
  label: string;
  /** Classe de l'examen ; `null` pour un jour férié, qui vaut pour toute l'école. */
  classId: string | null;
}

export function ScheduleView({
  years,
  classes,
  slots,
  exams,
  holidays,
  schoolName,
  todayIso,
}: {
  years: ScheduleYearOption[];
  classes: ScheduleClassOption[];
  slots: SlotRow[];
  exams: ScheduleEvent[];
  holidays: ScheduleEvent[];
  schoolName: string;
  /** Jour du rendu serveur : point de départ des vues, identique côté navigateur. */
  todayIso: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();

  const initialYear = years.find((y) => y.isCurrent) ?? years[0] ?? null;
  const [yearId, setYearId] = useState(initialYear?.id ?? "");
  const [classFilter, setClassFilter] = useState(
    () => classes.find((c) => c.academicYearId === initialYear?.id)?.id ?? "ALL",
  );
  const [teacherFilter, setTeacherFilter] = useState("ALL");
  const [view, setView] = useState<ScheduleViewMode>("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(`${todayIso}T00:00:00.000Z`)));
  const [monthCursor, setMonthCursor] = useState(() => ({
    year: Number(todayIso.slice(0, 4)),
    month: Number(todayIso.slice(5, 7)) - 1,
  }));
  const [form, setForm] = useState<{ day: number; start: string; end: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<SlotRow | null>(null);
  const [removing, setRemoving] = useState(false);

  const year = years.find((y) => y.id === yearId) ?? null;
  // Une année terminée se consulte, mais ne se modifie plus : ses classes sont
  // archivées, un cours ajouté n'y servirait à personne.
  const readOnly = !year?.isCurrent;

  const yearClasses = useMemo(
    () => classes.filter((c) => c.academicYearId === yearId),
    [classes, yearId],
  );
  const selectedClass = yearClasses.find((c) => c.id === classFilter) ?? null;

  const teachers = useMemo(() => {
    const names = new Map<string, string>();
    for (const c of yearClasses) {
      for (const cs of c.classSubjects) {
        if (cs.teacherId && cs.teacherName) names.set(cs.teacherId, cs.teacherName);
      }
    }
    return [...names.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [yearClasses]);

  const visibleSlots = useMemo(() => {
    const yearClassIds = new Set(yearClasses.map((c) => c.id));
    return slots.filter(
      (s) =>
        yearClassIds.has(s.classId) &&
        (classFilter === "ALL" || s.classId === classFilter) &&
        (teacherFilter === "ALL" || s.teacherId === teacherFilter),
    );
  }, [slots, yearClasses, classFilter, teacherFilter]);

  // Examens des classes affichées : la classe choisie, ou celles où
  // l'enseignant choisi fait cours.
  const visibleExams = useMemo(() => {
    const ids = new Set(classFilter === "ALL" ? visibleSlots.map((s) => s.classId) : [classFilter]);
    return exams.filter((e) => e.classId != null && ids.has(e.classId));
  }, [exams, visibleSlots, classFilter]);

  /**
   * Classes dont la semaine est entièrement vide. Le directeur ne consulte
   * qu'une classe à la fois : sans ce récapitulatif, une classe oubliée ne se
   * découvre que le jour de la rentrée.
   */
  const emptyClasses = useMemo(
    () => yearClasses.filter((c) => !slots.some((s) => s.classId === c.id)),
    [yearClasses, slots],
  );

  const canAdd = !readOnly && selectedClass != null && selectedClass.classSubjects.length > 0;
  const teacherName = teachers.find((te) => te.id === teacherFilter)?.name;

  function changeYear(id: string) {
    setYearId(id);
    setClassFilter(classes.find((c) => c.academicYearId === id)?.id ?? "ALL");
    setTeacherFilter("ALL");
  }

  function changeTeacher(id: string) {
    setTeacherFilter(id);
    // Sans enseignant choisi, « toutes les classes » superposerait toute
    // l'école dans une seule grille : on revient à une classe.
    if (id === "ALL" && classFilter === "ALL") setClassFilter(yearClasses[0]?.id ?? "ALL");
  }

  function pickClass(id: string) {
    setClassFilter(id);
    setTeacherFilter("ALL");
    setView("week");
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await deleteSlot(removeTarget.id);
      toast.success(t("schedule.slotRemoved"));
      setRemoveTarget(null);
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setRemoving(false);
    }
  }

  const sheetTitle = [schoolName, t("schedule.title"), selectedClass?.name ?? teacherName, year?.label]
    .filter(Boolean)
    .join(" — ");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav
            aria-label={t("nav.category.pedagogy")}
            className="no-print mb-1.5 flex items-center gap-1.5 text-xs text-foreground/50"
          >
            <span>{t("nav.category.pedagogy")}</span>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <span className="font-medium text-foreground/70">{t("schedule.title")}</span>
          </nav>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <CalendarDays className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("schedule.title")}</h1>
              <p className="mt-0.5 text-sm text-foreground/60">{t("schedule.subtitleManage")}</p>
            </div>
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <PdfButton
            elementId="schedule-sheet"
            fileName={`emploi-du-temps-${(selectedClass?.name ?? teacherName ?? "ecole").replace(/\s+/g, "-")}.pdf`}
            labelKey="schedule.exportPdf"
          />
          <PrintButton label={t("common.print")} />
          <Button
            className="shadow-sm"
            onClick={() => setForm({ day: 1, start: "08:00", end: "09:00" })}
            disabled={!canAdd}
            title={!selectedClass ? t("schedule.chooseClassFirst") : undefined}
          >
            <Plus className="h-4 w-4" />
            {t("schedule.newCourse")}
          </Button>
        </div>
      </div>

      {readOnly && year && (
        <div className="no-print flex items-center gap-2.5 rounded-xl border border-border bg-surface-muted/60 px-4 py-3 text-sm text-foreground/70">
          <Lock className="h-4 w-4 shrink-0" />
          {t("schedule.pastYear")}
        </div>
      )}

      {!readOnly && emptyClasses.length > 0 && (
        <div className="no-print flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">
              {emptyClasses.length} classe{emptyClasses.length > 1 ? "s" : ""} sans aucun cours programmé
            </p>
            <p className="mt-1 text-xs text-amber-800/80">
              Aucun créneau de toute la semaine pour : {emptyClasses.map((c) => c.name).join(", ")}.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {emptyClasses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickClass(c.id)}
                  className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-200"
                >
                  Remplir {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <ScheduleFilters
        years={years}
        yearId={yearId}
        onYearChange={changeYear}
        classes={yearClasses}
        classFilter={classFilter}
        onClassChange={setClassFilter}
        allowAllClasses={teacherFilter !== "ALL"}
        teachers={teachers}
        teacherFilter={teacherFilter}
        onTeacherChange={changeTeacher}
        view={view}
        onViewChange={setView}
      />

      <div id="schedule-sheet" className="space-y-3">
        <p data-pdf-show className="hidden text-center text-lg font-semibold text-foreground print:block">
          {sheetTitle}
        </p>

        {yearClasses.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-5 py-16 text-center text-sm text-foreground/50">
            {t("schedule.createClassFirst")}
          </div>
        ) : selectedClass && selectedClass.classSubjects.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-5 py-16 text-center text-sm text-foreground/50">
            {t("schedule.assignSubjectsFirst")}
          </div>
        ) : view === "week" ? (
          <WeekGrid
            weekStart={weekStart}
            onWeekChange={setWeekStart}
            todayIso={todayIso}
            slots={visibleSlots}
            exams={visibleExams}
            holidays={holidays}
            showClassNames={classFilter === "ALL"}
            canAdd={canAdd}
            canRemove={!readOnly}
            onAdd={(day, start, end) => setForm({ day, start, end })}
            onRemove={setRemoveTarget}
          />
        ) : (
          <MonthCalendar
            cursor={monthCursor}
            onCursorChange={setMonthCursor}
            todayIso={todayIso}
            slots={visibleSlots}
            exams={visibleExams}
            holidays={holidays}
            onPickDay={(date) => {
              setWeekStart(startOfWeek(date));
              setView("week");
            }}
          />
        )}
      </div>

      {selectedClass && (
        <SlotFormDialog
          open={form != null}
          onOpenChange={(open) => !open && setForm(null)}
          classId={selectedClass.id}
          className={selectedClass.name}
          classSubjects={selectedClass.classSubjects}
          defaultDay={form?.day ?? 1}
          defaultStart={form?.start ?? "08:00"}
          defaultEnd={form?.end ?? "09:00"}
        />
      )}
      <ConfirmDialog
        open={removeTarget != null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={t("schedule.removeCourseTitle")}
        description={t("schedule.removeSlotBody")}
        confirmLabel={t("schedule.removeCourse")}
        variant="danger"
        loading={removing}
        onConfirm={handleRemove}
      />
    </div>
  );
}
