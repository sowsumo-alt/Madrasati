"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Layers,
  Printer,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AreaChart } from "@/components/charts/area-chart";
import { ColumnChart } from "@/components/charts/chart-primitives";
import { ChartCard } from "@/components/stats/chart-card";
import { PeriodSelect, type PeriodMonths } from "@/components/stats/period-select";
import { SubjectAverageList } from "@/components/stats/subject-average-list";
import { LevelBars } from "@/components/stats/level-bars";
import { GenderSplit } from "@/components/stats/gender-split";
import { formatMRU } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";

export interface StatsPoint {
  label: string;
  value: number;
  /** Rang du mois sur les douze affichés (0 = le plus ancien). */
  index: number;
}

export interface StatsData {
  years: { id: string; label: string }[];
  yearId: string | null;

  totalStudents: number;
  newThisMonth: number;
  studentTrend: number[];

  overallAttendance: number | null;
  /** Écart en points entre les deux derniers mois d'appel. */
  attendanceChange: number | null;
  attendanceTrend: number[];

  totalRevenue: number;
  revenueChange: number | null;
  revenueTrend: number[];

  subjectCount: number;
  gradeCount: number;
  gradesTrend: number[];

  attendanceByMonth: StatsPoint[];
  revenueByMonth: StatsPoint[];
  subjectAverages: { label: string; value: number }[];
  levelDistribution: { label: string; value: number }[];
  /** Élèves effectivement rattachés à une classe (≤ totalStudents). */
  studentsInAClass: number;
  gender: { boys: number; girls: number; unknown: number };
  table: { label: string; attendance: number | null; revenue: number }[];
}

const lastMonths = (points: StatsPoint[], months: PeriodMonths) =>
  points.filter((p) => p.index >= 12 - months);
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;
const tabular = { fontVariantNumeric: "tabular-nums" } as const;

export function StatisticsView({ data }: { data: StatsData }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [attendanceMonths, setAttendanceMonths] = useState<PeriodMonths>(12);
  const [revenueMonths, setRevenueMonths] = useState<PeriodMonths>(12);

  const year = data.years.find((y) => y.id === data.yearId) ?? null;
  const attendancePoints = lastMonths(data.attendanceByMonth, attendanceMonths);
  const revenuePoints = lastMonths(data.revenueByMonth, revenueMonths);
  const withoutClass = data.totalStudents - data.studentsInAClass;
  const noData = t("stats.noData");

  const attendanceHint =
    data.overallAttendance == null
      ? t("stats.noRollCall")
      : data.attendanceChange == null
        ? t("stats.overYear")
        : `${signed(data.attendanceChange)} ${t("stats.points")} ${t("stats.thisMonth")}`;
  const revenueHint =
    data.revenueChange == null
      ? t("stats.overYear")
      : `${signed(data.revenueChange)}% ${t("stats.thisMonth")}`;

  function changeYear(id: string) {
    // Radix signale parfois une valeur vide : ignorée.
    if (!id || id === data.yearId) return;
    startTransition(() => router.push(`/directeur/statistiques?annee=${id}`));
  }

  return (
    <div className={cn("space-y-5 transition-opacity", pending && "opacity-60")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav
            aria-label={t("nav.dashboard")}
            className="no-print mb-1.5 flex items-center gap-1.5 text-xs text-foreground/50"
          >
            <span>{t("nav.dashboard")}</span>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <span className="font-medium text-foreground/70">{t("nav.statistics")}</span>
          </nav>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <BarChart3 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("nav.statistics")}</h1>
              <p className="mt-0.5 text-sm text-foreground/60">{t("stats.subtitleYear")}</p>
            </div>
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Select value={data.yearId ?? undefined} onValueChange={changeYear} disabled={data.years.length === 0}>
            <SelectTrigger className="h-10 w-auto min-w-[15rem] gap-2" aria-label={t("students.schoolYear")}>
              <span className="flex min-w-0 items-center gap-2">
                <CalendarRange className="h-4 w-4 shrink-0 text-primary-600" />
                <SelectValue>
                  {year ? `${t("students.schoolYear")} ${year.label}` : t("stats.noYear")}
                </SelectValue>
              </span>
            </SelectTrigger>
            <SelectContent>
              {data.years.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {t("students.schoolYear")} {y.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="shadow-sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            {t("stats.printReport")}
          </Button>
        </div>
      </div>

      {year && (
        <p data-pdf-show className="hidden text-center text-lg font-semibold text-foreground print:block">
          {t("nav.statistics")} — {t("students.schoolYear")} {year.label}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("stats.enrolledStudents")}
          value={String(data.totalStudents)}
          icon={Users}
          tone="emerald"
          hint={
            data.newThisMonth > 0
              ? t("stats.newThisMonth").replace("{n}", String(data.newThisMonth))
              : t("stats.noNewThisMonth")
          }
          hintPositive={data.newThisMonth > 0}
          trend={data.studentTrend}
          delay={40}
        />
        <KpiCard
          label={t("stats.attendanceRate")}
          value={data.overallAttendance == null ? "—" : `${data.overallAttendance}%`}
          icon={ClipboardCheck}
          tone="amber"
          hint={attendanceHint}
          hintPositive={(data.attendanceChange ?? 0) > 0}
          hintNegative={(data.attendanceChange ?? 0) < 0}
          trend={data.attendanceTrend}
          delay={80}
        />
        <KpiCard
          label={t("stats.collectedYear")}
          value={formatMRU(data.totalRevenue)}
          icon={Wallet}
          tone="blue"
          hint={revenueHint}
          hintPositive={(data.revenueChange ?? 0) > 0}
          hintNegative={(data.revenueChange ?? 0) < 0}
          trend={data.revenueTrend}
          delay={120}
        />
        <KpiCard
          label={t("stats.gradedSubjects")}
          value={String(data.subjectCount)}
          icon={BookOpen}
          tone="violet"
          hint={t("stats.gradesCount").replace("{n}", String(data.gradeCount))}
          trend={data.gradesTrend}
          delay={160}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard
          icon={ClipboardCheck}
          title={t("stats.attendanceByMonth")}
          action={<PeriodSelect value={attendanceMonths} onChange={setAttendanceMonths} />}
        >
          <AreaChart data={attendancePoints} unit="%" max={100} emptyLabel={noData} highlightLast />
        </ChartCard>
        <ChartCard
          icon={BarChart3}
          title={t("stats.revenueByMonth")}
          action={<PeriodSelect value={revenueMonths} onChange={setRevenueMonths} />}
        >
          {/* Douze mois à zéro tracés comme des barres vides laisseraient croire
              à un graphique cassé : on dit plutôt qu'il n'y a rien encore. */}
          {revenuePoints.every((p) => p.value === 0) ? (
            <p className="py-16 text-center text-xs text-foreground/40">{noData}</p>
          ) : (
            <ColumnChart data={revenuePoints} />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard icon={BookOpen} title={t("stats.averageBySubject")}>
          <SubjectAverageList data={data.subjectAverages} emptyLabel={noData} />
        </ChartCard>
        <ChartCard icon={Layers} title={t("stats.studentsByLevel")}>
          <LevelBars data={data.levelDistribution} emptyLabel={noData} />
          {/* Le total par niveau exclut forcément les élèves sans classe :
              on l'écrit, plutôt que de laisser un chiffre qui semble faux. */}
          <p className="mt-4 text-xs text-foreground/50">
            {t("stats.studentsInClassNote")
              .replace("{n}", String(data.studentsInAClass))
              .replace("{total}", String(data.totalStudents))}
            {withoutClass > 0 && ` ${t("stats.withoutClassNote").replace("{n}", String(withoutClass))}`}
          </p>
        </ChartCard>
      </div>

      <ChartCard icon={Users} title={t("stats.byGender")}>
        <GenderSplit
          boys={data.gender.boys}
          girls={data.gender.girls}
          unknown={data.gender.unknown}
          boysLabel={t("stats.boys")}
          girlsLabel={t("stats.girls")}
          unknownLabel={t("stats.genderUnknown").replace("{n}", String(data.gender.unknown))}
          emptyLabel={noData}
        />
      </ChartCard>

      {/* Vue tableau : chaque valeur reste lisible sans dépendre des graphiques. */}
      <details className="group rounded-2xl border border-border/80 bg-surface shadow-soft">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
          {t("stats.dataTable")}
          <ChevronDown className="h-4 w-4 text-foreground/50 transition-transform group-open:rotate-180" />
        </summary>
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/60 text-xs font-semibold uppercase tracking-wide text-foreground/50">
                <th className="px-5 py-3 text-start">{t("stats.month")}</th>
                <th className="px-5 py-3 text-start">{t("stats.attendance")}</th>
                <th className="px-5 py-3 text-start">{t("stats.revenue")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.table.map((row) => (
                <tr key={row.label}>
                  <td className="px-5 py-2.5 font-medium text-foreground">{row.label}</td>
                  <td className="px-5 py-2.5 text-foreground/70" style={tabular}>
                    {row.attendance == null ? "—" : `${row.attendance}%`}
                  </td>
                  <td className="px-5 py-2.5 text-foreground/70" style={tabular}>
                    {formatMRU(row.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
