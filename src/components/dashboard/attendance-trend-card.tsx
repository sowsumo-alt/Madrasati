"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AreaChart } from "@/components/charts/area-chart";
import type { Point } from "@/components/charts/chart-primitives";
import { useLanguage } from "@/lib/i18n/language-provider";
import { SectionCard } from "./section-card";

type Period = "week" | "months";

/**
 * Évolution du taux de présence, sur la semaine en cours ou sur les derniers
 * mois. S'ouvre sur la semaine dès qu'un appel y a été fait.
 */
export function AttendanceTrendCard({
  week,
  months,
  delay,
}: {
  week: Point[];
  months: Point[];
  delay?: number;
}) {
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>(week.length > 0 ? "week" : "months");

  return (
    <SectionCard
      title={t("dashboard.attendanceTrend")}
      delay={delay}
      headerExtra={
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger
            className="h-9 w-auto gap-2 rounded-lg px-3 text-xs"
            aria-label={t("dashboard.attendanceTrend")}
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-foreground/50" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">{t("dashboard.thisWeek")}</SelectItem>
            <SelectItem value="months">{t("dashboard.lastMonths")}</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <AreaChart
        data={period === "week" ? week : months}
        unit="%"
        max={100}
        emptyLabel={t("dashboard.noAttendanceData")}
      />
    </SectionCard>
  );
}
