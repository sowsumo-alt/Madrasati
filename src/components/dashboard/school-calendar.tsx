"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-provider";
import { SectionCard } from "./section-card";

export interface CalendarEvent {
  /** Jour au format "2026-09-13" (UTC). */
  day: string;
  kind: "exam" | "holiday";
  label: string;
}

const DAY_MS = 86_400_000;

const EVENT_DOT: Record<CalendarEvent["kind"], string> = {
  exam: "bg-violet-500",
  holiday: "bg-accent-500",
};

/** « lun. » devient « Lun » : libellé court sans point final. */
function shortLabel(value: string) {
  const trimmed = value.replace(/\.$/, "");
  return trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1);
}

/**
 * Calendrier du mois, semaine commençant le lundi. Un point marque les jours
 * d'examen et les jours fériés ; le détail apparaît au survol du jour.
 */
export function SchoolCalendar({
  todayIso,
  events,
  delay,
}: {
  todayIso: string;
  events: CalendarEvent[];
  delay?: number;
}) {
  const { t, locale } = useLanguage();
  const [cursor, setCursor] = useState(() => ({
    year: Number(todayIso.slice(0, 4)),
    month: Number(todayIso.slice(5, 7)) - 1,
  }));

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) map.set(event.day, [...(map.get(event.day) ?? []), event]);
    return map;
  }, [events]);

  // Chiffres latins en arabe, comme partout ailleurs dans l'application.
  const intlLocale = locale === "ar" ? "ar-u-nu-latn" : locale;
  const monthLabel = new Intl.DateTimeFormat(intlLocale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(cursor.year, cursor.month, 1)));
  const weekdayFormatter = new Intl.DateTimeFormat(intlLocale, { weekday: "short", timeZone: "UTC" });
  // Le 1er janvier 2024 est un lundi : point de départ des en-têtes de colonnes.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    shortLabel(weekdayFormatter.format(new Date(Date.UTC(2024, 0, 1 + i)))),
  );

  const firstOfMonth = Date.UTC(cursor.year, cursor.month, 1);
  const leadingDays = (new Date(firstOfMonth).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((leadingDays + daysInMonth) / 7) * 7 }, (_, i) => {
    const date = new Date(firstOfMonth + (i - leadingDays) * DAY_MS);
    const iso = date.toISOString().slice(0, 10);
    return {
      iso,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === cursor.month,
      events: eventsByDay.get(iso) ?? [],
    };
  });

  function shift(delta: number) {
    setCursor(({ year, month }) => {
      const d = new Date(Date.UTC(year, month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  }

  return (
    <SectionCard title={t("dashboard.schoolCalendar")} icon={CalendarDays} delay={delay}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label={t("dashboard.previousMonth")}
          className="rounded-lg p-1.5 text-foreground/60 transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </button>
        <p className="text-sm font-semibold capitalize text-foreground" aria-live="polite">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label={t("dashboard.nextMonth")}
          className="rounded-lg p-1.5 text-foreground/60 transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {weekdays.map((label, i) => (
          <span key={i} className="pb-1 text-[11px] font-medium text-foreground/45">
            {label}
          </span>
        ))}
        {cells.map((cell) => {
          const isToday = cell.iso === todayIso;
          const kinds = [...new Set(cell.events.map((e) => e.kind))];
          const title = cell.events
            .map((e) => `${e.kind === "holiday" ? t("dashboard.holiday") : t("dashboard.exam")} : ${e.label}`)
            .join("\n");
          return (
            <div
              key={cell.iso}
              title={title || undefined}
              className="flex flex-col items-center gap-0.5 py-0.5"
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs",
                  isToday
                    ? "bg-primary-700 font-semibold text-white shadow-sm"
                    : cell.inMonth
                      ? "text-foreground/80"
                      : "text-foreground/25",
                  kinds.length > 0 && !isToday && "font-semibold text-foreground",
                )}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {cell.day}
              </span>
              <span className="flex h-1.5 gap-0.5">
                {kinds.map((kind) => (
                  <span key={kind} className={cn("h-1.5 w-1.5 rounded-full", EVENT_DOT[kind])} />
                ))}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border/70 pt-3 text-xs text-foreground/55">
        <span className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", EVENT_DOT.exam)} />
          {t("dashboard.exam")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full", EVENT_DOT.holiday)} />
          {t("dashboard.holiday")}
        </span>
      </div>
    </SectionCard>
  );
}
