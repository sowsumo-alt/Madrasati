"use client";

import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  PartyPopper,
} from "lucide-react";
import { formatDateIn } from "@/lib/format";
import { isoDay } from "@/lib/dashboard-data";
import { isoWeekday, monthCells } from "@/lib/schedule";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { ScheduleEvent, SlotRow } from "../schedule-view";

const navButton =
  "flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground/60 transition-colors hover:bg-surface-muted";

/**
 * Vue mensuelle : l'emploi du temps se répète chaque semaine, alors le mois
 * montre ce qui change d'un jour à l'autre — le nombre de cours du jour, les
 * examens et les jours fériés. Un clic sur un jour ouvre sa semaine.
 */
export function MonthCalendar({
  cursor,
  onCursorChange,
  todayIso,
  slots,
  exams,
  holidays,
  onPickDay,
}: {
  cursor: { year: number; month: number };
  onCursorChange: (cursor: { year: number; month: number }) => void;
  todayIso: string;
  slots: SlotRow[];
  exams: ScheduleEvent[];
  holidays: ScheduleEvent[];
  onPickDay: (date: Date) => void;
}) {
  const { t, locale } = useLanguage();
  const cells = monthCells(cursor.year, cursor.month);
  const today = new Date(`${todayIso}T00:00:00.000Z`);
  const isCurrentMonth =
    cursor.year === today.getUTCFullYear() && cursor.month === today.getUTCMonth();

  const coursesByWeekday = new Map<number, number>();
  for (const s of slots) {
    coursesByWeekday.set(s.dayOfWeek, (coursesByWeekday.get(s.dayOfWeek) ?? 0) + 1);
  }

  // Le 1er janvier 2024 est un lundi : en-têtes des colonnes, lundi en premier.
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    formatDateIn(locale, new Date(Date.UTC(2024, 0, 1 + i)), { weekday: "short" }).replace(/\.$/, ""),
  );

  function shift(delta: number) {
    const d = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
    onCursorChange({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-semibold capitalize text-foreground">
          <CalendarRange className="h-5 w-5 text-primary-600" />
          {formatDateIn(locale, new Date(Date.UTC(cursor.year, cursor.month, 1)), {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <div className="no-print flex items-center gap-1.5">
          <button type="button" onClick={() => shift(-1)} aria-label={t("dashboard.previousMonth")} className={navButton}>
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => onCursorChange({ year: today.getUTCFullYear(), month: today.getUTCMonth() })}
            disabled={isCurrentMonth}
            className="h-9 rounded-lg border border-border px-3.5 text-sm font-medium text-foreground/75 transition-colors hover:bg-surface-muted disabled:opacity-50"
          >
            {t("dashboard.today")}
          </button>
          <button type="button" onClick={() => shift(1)} aria-label={t("dashboard.nextMonth")} className={navButton}>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[42rem] grid-cols-7">
          {weekdayLabels.map((label, i) => (
            <div
              key={i}
              className={cn(
                "border-b border-border bg-surface-muted/60 px-2 py-2.5 text-center text-xs font-semibold capitalize",
                i >= 5 ? "text-foreground/35" : "text-foreground/60",
              )}
            >
              {label}
            </div>
          ))}
          {cells.map(({ date, inMonth }, index) => {
            const iso = isoDay(date);
            const weekday = isoWeekday(date);
            const isWeekend = weekday >= 6;
            const holiday = holidays.find((h) => h.day === iso);
            const dayExams = exams.filter((e) => e.day === iso);
            const courses = isWeekend || holiday ? 0 : (coursesByWeekday.get(weekday) ?? 0);
            const isToday = iso === todayIso;

            return (
              <button
                key={iso}
                type="button"
                onClick={() => onPickDay(date)}
                disabled={isWeekend}
                className={cn(
                  "flex min-h-[6.5rem] flex-col items-stretch gap-1 border-b border-border p-2 text-start transition-colors",
                  index % 7 !== 6 && "border-e",
                  inMonth ? "bg-surface" : "bg-surface-muted/40",
                  isWeekend ? "cursor-default" : "hover:bg-primary-50/60",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-sm",
                    isToday
                      ? "bg-primary-700 font-semibold text-white"
                      : inMonth
                        ? "font-medium text-foreground"
                        : "text-foreground/35",
                  )}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {date.getUTCDate()}
                </span>
                {holiday && (
                  <span
                    title={holiday.label}
                    className="truncate rounded-md bg-accent-50 px-1.5 py-0.5 text-[11px] font-medium text-accent-700"
                  >
                    <PartyPopper className="me-1 inline h-3 w-3" />
                    {holiday.label}
                  </span>
                )}
                {courses > 0 && (
                  <span className="rounded-md bg-primary-50 px-1.5 py-0.5 text-[11px] font-medium text-primary-700">
                    {t("schedule.coursesCount").replace("{n}", String(courses))}
                  </span>
                )}
                {dayExams.slice(0, 2).map((e) => (
                  <span
                    key={e.id}
                    title={e.label}
                    className="truncate rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700"
                  >
                    <GraduationCap className="me-1 inline h-3 w-3" />
                    {e.label}
                  </span>
                ))}
                {dayExams.length > 2 && (
                  <span className="text-[11px] text-foreground/50">+{dayExams.length - 2}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
