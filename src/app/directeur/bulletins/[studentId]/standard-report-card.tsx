import type { ReactNode } from "react";
import Image from "next/image";
import type { ReportCard } from "@/lib/report-card-compute";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { formatDelta, type CardEvolution, type Evolution } from "@/lib/report-card-checks";
import { cn } from "@/lib/utils";
import type { OfficialHeaderText, SchoolIdentity } from "@/lib/official-header";
import { DocumentHeader } from "@/components/documents/document-header";

/**
 * Bulletin d'origine de Madrasati, celui du Fondamental (et des classes au
 * niveau non reconnu). Partagé par la page d'un élève et par la génération
 * des bulletins de toute une classe.
 */

const TREND_ARROW = { UP: "↗", DOWN: "↘", STABLE: "→" } as const;

function Trend({ value, long }: { value: Evolution; long?: boolean }) {
  return (
    <span
      className={cn(
        value.trend === "UP" ? "text-green-700" : value.trend === "DOWN" ? "text-red-700" : "text-foreground/50",
      )}
      data-testid={long ? "general-evolution" : "subject-evolution"}
    >
      {TREND_ARROW[value.trend]} {value.trend === "STABLE" ? "stable" : formatDelta(value.delta)}
      {long ? ` par rapport au ${value.previousTerm}` : ""}
    </span>
  );
}

export function StandardReportCard({
  id,
  card,
  t,
  school,
  official,
  yearLabel,
  photoUrl,
  commentSlot,
  evolution,
  incomplete,
}: {
  id: string;
  card: ReportCard;
  t: (key: TranslationKey) => string;
  school: SchoolIdentity;
  /** Bloc de l'État, commun à toutes les écoles (voir loadOfficialHeader). */
  official: OfficialHeaderText;
  yearLabel: string | null;
  photoUrl: string | null;
  /** L'appréciation : l'éditeur sur la page d'un élève, le texte seul en lot. */
  commentSlot?: ReactNode;
  evolution?: CardEvolution | null;
  incomplete?: boolean;
}) {
  return (
    <div
      id={id}
      className="rounded-xl border border-border bg-surface p-8 shadow-sm print:border-0 print:p-0 print:shadow-none"
    >
      <DocumentHeader school={school} official={official} />

      <div className="flex items-baseline justify-between border-b border-border pb-4">
        <p className="text-sm font-bold uppercase tracking-wide text-foreground">
          {t("bulletin.reportCardTitle")} — {card.term}
        </p>
        {yearLabel && (
          <p className="text-xs text-foreground/50">
            {t("bulletin.year")} {yearLabel}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6 py-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
            {t("finance.student")}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm font-medium text-foreground">
            {photoUrl && (
              <Image
                src={photoUrl}
                alt=""
                width={240}
                height={240}
                unoptimized
                className="h-10 w-10 rounded-full object-cover"
              />
            )}
            {card.student.firstName} {card.student.lastName}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
            {t("students.class")}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{card.className}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
            {t("bulletin.attendance")}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {card.attendance.absent} {t("bulletin.absences")}, {card.attendance.late}{" "}
            {t("bulletin.lates")}
          </p>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
            <th className="px-3 py-2.5">{t("bulletin.subject")}</th>
            <th className="px-3 py-2.5 text-center">{t("bulletin.coefficient")}</th>
            <th className="px-3 py-2.5 text-center">{t("bulletin.average")}</th>
            <th className="px-3 py-2.5 text-center">{t("bulletin.classAverage")}</th>
            <th className="px-3 py-2.5 text-right" dir="rtl" lang="ar">
              المادة
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {card.results.map((r) => (
            <tr key={r.subjectName} data-testid="subject-row" data-subject={r.subjectName}>
              <td className="px-3 py-2.5 text-foreground">{r.subjectName}</td>
              <td className="px-3 py-2.5 text-center text-foreground/70">{r.coefficient}</td>
              <td className="px-3 py-2.5 text-center font-medium text-foreground" data-testid="subject-average">
                {r.average != null ? r.average.toFixed(2) : "—"}
                {evolution?.bySubject[r.subjectName] && (
                  <span className="block text-[11px] font-normal">
                    <Trend value={evolution.bySubject[r.subjectName]} />
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-center text-foreground/60">
                {r.classAverage != null ? r.classAverage.toFixed(2) : "—"}
              </td>
              <td className="px-3 py-2.5 text-right text-foreground" dir="rtl" lang="ar">
                {r.subjectNameAr ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 grid grid-cols-3 gap-4 rounded-lg bg-surface-muted px-4 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
            {t("bulletin.overallAverage")}
          </p>
          <p className="mt-1 text-xl font-semibold text-primary-800" data-testid="general-average">
            {card.average != null ? `${card.average.toFixed(2)} / 20` : "—"}
          </p>
          {evolution?.general && (
            <p className="mt-0.5 text-xs font-semibold">
              <Trend value={evolution.general} long />
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
            {t("bulletin.mentionLabel")}
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {t(`bulletin.mention.${card.mention}` as TranslationKey)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
            {t("bulletin.rank")}
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {card.rank != null ? `${card.rank} / ${card.classSize}` : "—"}
          </p>
        </div>
      </div>

      {commentSlot}

      <div className="mt-8 flex justify-between text-xs text-foreground/50">
        <div>
          <p className="mb-8">{t("bulletin.directorSignature")}</p>
          <div className="w-40 border-t border-border" />
        </div>
        <div className="text-right">
          <p className="mb-8">{t("bulletin.parentSignature")}</p>
          <div className="ml-auto w-40 border-t border-border" />
        </div>
      </div>

      {incomplete && (
        <p className="mt-6 text-center text-[11px] italic text-foreground/45" data-testid="incomplete-mention">
          Certaines notes n&apos;étaient pas disponibles à la génération de ce bulletin.
        </p>
      )}

      <p className="mt-8 text-center text-xs text-foreground/40">{t("bulletin.footer")}</p>
    </div>
  );
}
