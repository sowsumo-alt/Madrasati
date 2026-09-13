"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n/language-provider";
import { topWithOthers, type Share } from "@/lib/dashboard-data";
import { SectionCard } from "./section-card";

// Verts de la marque, puis bleus et or : six parts au plus (topWithOthers),
// chacune avec son effectif et son pourcentage écrits en légende — la couleur
// ne suffit jamais seule à reconnaître une classe.
const COLORS = ["#0b6b3f", "#22a06b", "#7fd1a8", "#3b82f6", "#1e3a8a", "#e0a82e"];

type Mode = "class" | "level";

const round = (n: number) => Math.round(n * 100) / 100;

/** Répartition des élèves actifs, par classe ou par niveau, en anneau. */
export function ClassDistributionCard({
  byClass,
  byLevel,
  delay,
}: {
  byClass: Share[];
  byLevel: Share[];
  delay?: number;
}) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<Mode>("class");

  const shares = topWithOthers(
    mode === "class" ? byClass : byLevel,
    COLORS.length,
    t("dashboard.others"),
  );
  const total = shares.reduce((sum, s) => sum + s.value, 0);

  const R = 60;
  const STROKE = 20;
  const C = 2 * Math.PI * R;
  const GAP = shares.length > 1 ? 2.5 : 0;

  let offset = 0;
  const arcs = shares.map((s, i) => {
    const length = (s.value / total) * C;
    const arc = {
      ...s,
      color: COLORS[i],
      dash: Math.max(0, length - GAP),
      offset,
      percent: Math.round((s.value / total) * 100),
    };
    offset += length;
    return arc;
  });

  return (
    <SectionCard
      title={t("dashboard.distributionByClass")}
      delay={delay}
      headerExtra={
        <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <SelectTrigger
            className="h-8 w-auto gap-1.5 rounded-lg px-2.5 text-xs"
            aria-label={t("dashboard.distributionByClass")}
          >
            {/* Libellé explicite, comme dans AttendanceTrendCard. */}
            <SelectValue>
              {mode === "class" ? t("dashboard.byClass") : t("dashboard.byLevel")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="class">{t("dashboard.byClass")}</SelectItem>
            <SelectItem value="level">{t("dashboard.byLevel")}</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      {total === 0 ? (
        <p className="py-12 text-center text-sm text-foreground/50">
          {t("dashboard.noStudentsYet")}
        </p>
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
          <div className="relative h-44 w-44 shrink-0">
            <svg
              viewBox="0 0 160 160"
              className="h-full w-full -rotate-90"
              role="img"
              aria-label={arcs.map((a) => `${a.label} ${a.value}`).join(", ")}
            >
              <circle cx={80} cy={80} r={R} fill="none" stroke="#eef1ee" strokeWidth={STROKE} />
              {arcs.map((a) => (
                <circle
                  key={a.label}
                  cx={80}
                  cy={80}
                  r={R}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${round(a.dash)} ${round(C - a.dash)}`}
                  strokeDashoffset={round(-a.offset)}
                >
                  <title>{`${a.label} : ${a.value} (${a.percent}%)`}</title>
                </circle>
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-2xl font-bold text-foreground"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {total}
              </span>
              <span className="text-xs text-foreground/55">{t("dashboard.studentsUnit")}</span>
            </div>
          </div>

          <ul className="w-full max-w-[15rem] space-y-2.5">
            {arcs.map((a) => (
              <li
                key={a.label}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 text-sm"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
                <span className="truncate text-foreground/75">{a.label}</span>
                <span
                  className="font-semibold text-foreground"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {a.value}
                </span>
                <span
                  className="w-12 text-end text-xs text-foreground/50"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  ({a.percent}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}
