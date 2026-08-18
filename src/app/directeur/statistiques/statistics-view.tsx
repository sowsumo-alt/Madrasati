"use client";

import { Users, ClipboardCheck, Wallet, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { PrintButton } from "@/components/ui/print-button";
import { formatMRU } from "@/lib/format";
import {
  LineChart,
  ColumnChart,
  BarList,
  SplitBar,
  SERIE,
  SERIE_2,
} from "@/components/charts/chart-primitives";

export interface StatsData {
  totalStudents: number;
  overallAttendance: number;
  totalRevenue: number;
  subjectCount: number;
  attendanceByMonth: { label: string; value: number }[];
  revenueByMonth: { label: string; value: number }[];
  subjectAverages: { label: string; value: number }[];
  levelDistribution: { label: string; value: number }[];
  /** Élèves actifs effectivement rattachés à une classe (≤ totalStudents). */
  studentsInAClass: number;
  gender: { boys: number; girls: number; unknown: number };
}

export function StatisticsView({ data }: { data: StatsData }) {
  const genderSegments = [
    { label: "Garçons", value: data.gender.boys, color: SERIE },
    { label: "Filles", value: data.gender.girls, color: SERIE_2 },
    ...(data.gender.unknown > 0
      ? [{ label: "Non renseigné", value: data.gender.unknown, color: "#c3c2b7" }]
      : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Statistiques</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Vue d&apos;ensemble de l&apos;école sur les six derniers mois.
          </p>
        </div>
        <PrintButton label="Imprimer" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Élèves inscrits" value={String(data.totalStudents)} icon={Users} tone="primary" />
        <StatTile
          label="Taux de présence"
          value={`${data.overallAttendance} %`}
          icon={ClipboardCheck}
          tone="primary"
        />
        <StatTile
          label="Encaissé (6 mois)"
          value={formatMRU(data.totalRevenue)}
          icon={Wallet}
          tone="accent"
        />
        <StatTile
          label="Matières notées"
          value={String(data.subjectCount)}
          icon={BookOpen}
          tone="primary"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Présence par mois (%)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <LineChart data={data.attendanceByMonth} unit=" %" maxOverride={100} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Revenus encaissés par mois (MRU)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <ColumnChart data={data.revenueByMonth} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Moyenne par matière (sur 20)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <BarList data={data.subjectAverages} maxOverride={20} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Élèves par niveau</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <BarList data={data.levelDistribution} />
            {/* Le total par niveau exclut forcément les élèves sans classe :
                on l'écrit, plutôt que de laisser un chiffre qui semble faux. */}
            <p className="mt-3 text-xs text-foreground/50">
              {data.studentsInAClass} élève{data.studentsInAClass > 1 ? "s" : ""} affecté
              {data.studentsInAClass > 1 ? "s" : ""} à une classe sur {data.totalStudents}{" "}
              au total
              {data.totalStudents - data.studentsInAClass > 0 && (
                <>
                  {" "}
                  — {data.totalStudents - data.studentsInAClass} sans classe, non
                  comptabilisé
                  {data.totalStudents - data.studentsInAClass > 1 ? "s" : ""} ici
                </>
              )}
              .
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Répartition par genre</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <SplitBar segments={genderSegments} />
          </CardContent>
        </Card>
      </div>

      {/* Vue tableau : toute valeur reste lisible sans dépendre de la couleur. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tableau des données</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">Mois</th>
                  <th className="px-5 py-3">Présence</th>
                  <th className="px-5 py-3">Revenus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.attendanceByMonth.map((m, i) => (
                  <tr key={m.label}>
                    <td className="px-5 py-2.5 font-medium text-foreground">{m.label}</td>
                    <td
                      className="px-5 py-2.5 text-foreground/70"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {m.value} %
                    </td>
                    <td
                      className="px-5 py-2.5 text-foreground/70"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatMRU(data.revenueByMonth[i]?.value ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
