"use client";

import type { ReactNode } from "react";
import { CalendarDays, CalendarRange, UserRound, Users, type LucideIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";

export type ScheduleViewMode = "week" | "month";

// Un libellé long (« Tous les enseignants ») reste sur une ligne, tronqué,
// au lieu de passer à la ligne et de se centrer dans le bouton. La valeur est
// visée depuis le bouton : Radix ignore la classe posée sur SelectValue.
const trigger = "h-9 gap-2 text-start [&>span:first-child]:min-w-0 [&>span:first-child]:truncate";

function FilterCard({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/80 bg-surface p-3 shadow-soft">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-medium text-foreground/50">{label}</p>
        {children}
      </div>
    </div>
  );
}

/** Année scolaire, classe, enseignant, et bascule entre vue de la semaine et du mois. */
export function ScheduleFilters({
  years,
  yearId,
  onYearChange,
  classes,
  classFilter,
  onClassChange,
  allowAllClasses,
  teachers,
  teacherFilter,
  onTeacherChange,
  view,
  onViewChange,
}: {
  years: { id: string; label: string }[];
  yearId: string;
  onYearChange: (id: string) => void;
  classes: { id: string; name: string }[];
  classFilter: string;
  onClassChange: (id: string) => void;
  /** « Toutes les classes » n'a de sens qu'avec un enseignant choisi. */
  allowAllClasses: boolean;
  teachers: { id: string; name: string }[];
  teacherFilter: string;
  onTeacherChange: (id: string) => void;
  view: ScheduleViewMode;
  onViewChange: (view: ScheduleViewMode) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="no-print grid gap-3 md:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
      <FilterCard icon={CalendarRange} label={t("students.schoolYear")}>
        <Select value={yearId} onValueChange={onYearChange} disabled={years.length === 0}>
          <SelectTrigger className={trigger}>
            <SelectValue>{years.find((y) => y.id === yearId)?.label ?? "—"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y.id} value={y.id}>
                {y.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterCard>

      <FilterCard icon={Users} label={t("students.class")}>
        <Select value={classFilter} onValueChange={onClassChange} disabled={classes.length === 0}>
          <SelectTrigger className={trigger}>
            <SelectValue>
              {classFilter === "ALL"
                ? t("students.allClasses")
                : (classes.find((c) => c.id === classFilter)?.name ?? "—")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {allowAllClasses && <SelectItem value="ALL">{t("students.allClasses")}</SelectItem>}
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterCard>

      <FilterCard icon={UserRound} label={t("schedule.teacher")}>
        <Select value={teacherFilter} onValueChange={onTeacherChange}>
          <SelectTrigger className={trigger}>
            <SelectValue>
              {teacherFilter === "ALL"
                ? t("schedule.allTeachers")
                : (teachers.find((te) => te.id === teacherFilter)?.name ?? "—")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("schedule.allTeachers")}</SelectItem>
            {teachers.map((te) => (
              <SelectItem key={te.id} value={te.id}>
                {te.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterCard>

      <div className="flex items-center gap-1 rounded-2xl border border-border/80 bg-surface p-1.5 shadow-soft md:col-span-2 xl:col-span-1">
        {(["week", "month"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewChange(mode)}
            aria-pressed={view === mode}
            className={cn(
              "flex h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold transition-colors",
              view === mode ? "bg-primary-700 text-white shadow-sm" : "text-foreground/65 hover:bg-surface-muted",
            )}
          >
            {mode === "week" ? <CalendarDays className="h-4 w-4" /> : <CalendarRange className="h-4 w-4" />}
            {mode === "week" ? t("schedule.weekView") : t("schedule.monthView")}
          </button>
        ))}
      </div>
    </div>
  );
}
