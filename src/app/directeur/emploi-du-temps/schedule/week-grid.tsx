"use client";

import { Fragment } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  PartyPopper,
  Plus,
} from "lucide-react";
import { formatDateIn } from "@/lib/format";
import { isoDay, minutesToTime } from "@/lib/dashboard-data";
import { addWeeks, displayedWeekStart, schoolDays, timeRows } from "@/lib/schedule";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { ScheduleEvent, SlotRow } from "../schedule-view";
import { CourseCard } from "./course-card";

const navButton =
  "flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground/60 transition-colors hover:bg-surface-muted";

/**
 * Grille de la semaine : les plages horaires en lignes, du lundi au vendredi
 * en colonnes. Les jours portent leur date, et signalent jours fériés et
 * examens de la semaine affichée.
 */
export function WeekGrid({
  weekStart,
  onWeekChange,
  todayIso,
  slots,
  exams,
  holidays,
  showClassNames,
  canAdd,
  canRemove,
  onAdd,
  onRemove,
}: {
  /** Lundi de la semaine affichée (UTC). */
  weekStart: Date;
  onWeekChange: (monday: Date) => void;
  todayIso: string;
  slots: SlotRow[];
  exams: ScheduleEvent[];
  holidays: ScheduleEvent[];
  showClassNames: boolean;
  canAdd: boolean;
  canRemove: boolean;
  onAdd: (dayOfWeek: number, start: string, end: string) => void;
  onRemove: (slot: SlotRow) => void;
}) {
  const { t, locale } = useLanguage();
  const days = schoolDays(weekStart);
  const rows = timeRows(slots);
  const friday = days[4];
  const currentMonday = displayedWeekStart(new Date(`${todayIso}T00:00:00.000Z`));
  const isCurrentWeek = isoDay(currentMonday) === isoDay(weekStart);

  const sameMonth = weekStart.getUTCMonth() === friday.getUTCMonth();
  const title = t("schedule.weekOf")
    .replace("{from}", formatDateIn(locale, weekStart, sameMonth ? { day: "numeric" } : { day: "numeric", month: "long" }))
    .replace("{to}", formatDateIn(locale, friday, { day: "numeric", month: "long", year: "numeric" }));

  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <CalendarDays className="h-5 w-5 text-primary-600" />
          {title}
        </h2>
        <div className="no-print flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onWeekChange(addWeeks(weekStart, -1))}
            aria-label={t("schedule.previousWeek")}
            className={navButton}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => onWeekChange(currentMonday)}
            disabled={isCurrentWeek}
            className="h-9 rounded-lg border border-border px-3.5 text-sm font-medium text-foreground/75 transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            {t("dashboard.today")}
          </button>
          <button
            type="button"
            onClick={() => onWeekChange(addWeeks(weekStart, 1))}
            aria-label={t("schedule.nextWeek")}
            className={navButton}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-16 text-center text-sm text-foreground/50">
          {t("schedule.noCourseForFilter")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[58rem] grid-cols-[7rem_repeat(5,minmax(0,1fr))]">
            <div className="sticky start-0 z-10 flex items-center justify-center border-b border-e border-border bg-surface-muted px-2 py-3 text-xs font-semibold text-foreground/60">
              {t("schedule.time")}
            </div>
            {days.map((date, i) => {
              const iso = isoDay(date);
              const holiday = holidays.find((h) => h.day === iso);
              const dayExams = exams.filter((e) => e.day === iso);
              const isToday = iso === todayIso;
              return (
                <div
                  key={iso}
                  className={cn(
                    "border-b border-border px-2 py-2.5 text-center",
                    i < 4 && "border-e",
                    isToday ? "bg-primary-50" : "bg-surface-muted/60",
                  )}
                >
                  <p className={cn("text-sm font-semibold capitalize", isToday ? "text-primary-800" : "text-foreground")}>
                    {formatDateIn(locale, date, { weekday: "long" })}
                  </p>
                  <p className="text-xs text-foreground/50">
                    {formatDateIn(locale, date, { day: "numeric", month: "long" })}
                  </p>
                  {(holiday || dayExams.length > 0) && (
                    <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                      {holiday && (
                        <span
                          title={holiday.label}
                          className="inline-flex max-w-full items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-medium text-accent-700"
                        >
                          <PartyPopper className="h-3 w-3 shrink-0" />
                          <span className="truncate">{holiday.label}</span>
                        </span>
                      )}
                      {dayExams.length > 0 && (
                        <span
                          title={dayExams.map((e) => e.label).join("\n")}
                          className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700"
                        >
                          <GraduationCap className="h-3 w-3" />
                          {t("schedule.examsCount").replace("{n}", String(dayExams.length))}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {rows.map((row) => (
              <Fragment key={`${row.startMinutes}-${row.endMinutes}`}>
                <div
                  className="sticky start-0 z-10 flex items-center justify-center border-b border-e border-border bg-surface px-2 py-3 text-xs font-semibold text-foreground/75"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  <span dir="ltr" className="whitespace-nowrap">
                    {minutesToTime(row.startMinutes)} – {minutesToTime(row.endMinutes)}
                  </span>
                </div>
                {days.map((date, i) => {
                  const iso = isoDay(date);
                  const dayOfWeek = i + 1;
                  const cellSlots = slots.filter(
                    (s) =>
                      s.dayOfWeek === dayOfWeek &&
                      s.startMinutes === row.startMinutes &&
                      s.endMinutes === row.endMinutes,
                  );
                  const isHoliday = holidays.some((h) => h.day === iso);
                  return (
                    <div
                      key={iso}
                      className={cn(
                        "space-y-1.5 border-b border-border p-1.5",
                        i < 4 && "border-e",
                        isHoliday && "bg-accent-50/30",
                      )}
                    >
                      {cellSlots.map((s) => (
                        <CourseCard
                          key={s.id}
                          subjectName={s.subjectName}
                          teacherName={s.teacherName}
                          room={s.room}
                          className={showClassNames ? s.className : undefined}
                          roomLabel={t("dashboard.room")}
                          removeLabel={t("schedule.removeCourse")}
                          onRemove={canRemove ? () => onRemove(s) : undefined}
                        />
                      ))}
                      {cellSlots.length === 0 &&
                        (canAdd ? (
                          <button
                            type="button"
                            onClick={() =>
                              onAdd(dayOfWeek, minutesToTime(row.startMinutes), minutesToTime(row.endMinutes))
                            }
                            title={t("schedule.addHere")}
                            aria-label={t("schedule.addHere")}
                            className="no-print flex min-h-[4.5rem] w-full items-center justify-center rounded-xl border border-dashed border-transparent text-foreground/0 transition-colors hover:border-primary-300 hover:bg-primary-50/50 hover:text-primary-600 focus:border-primary-300 focus:text-primary-600 focus:outline-none"
                          >
                            <Plus className="h-5 w-5" />
                          </button>
                        ) : (
                          <div className="min-h-[4.5rem]" />
                        ))}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
