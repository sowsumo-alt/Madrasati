"use client";

import type { ReactNode } from "react";
import { PenLine, Pencil } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { subjectStyle } from "@/components/subjects/subject-style";
import type { ExamGroup } from "@/lib/exam-groups";
import { isExamKind } from "@/lib/exams";
import { formatDateIn } from "@/lib/format";
import { minutesToTime } from "@/lib/dashboard-data";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import type { ExamRow } from "../exams-view";
import { ExamStatusBadge, GradingBadge } from "./exam-badges";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-foreground/55">{label}</dt>
      <dd className="min-w-0 text-end text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

const pill = "rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-foreground/70 ring-1 ring-border";

/**
 * Fiche d'un examen (bouton « œil ») : ses informations, ses consignes et,
 * classe par classe, l'avancement de la saisie et la moyenne — avec l'accès
 * direct à la saisie des notes de chaque classe.
 */
export function ExamDetailSheet({
  group,
  canManage,
  onClose,
  onEdit,
  onEnterGrades,
}: {
  group: ExamGroup<ExamRow> | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (exam: ExamRow) => void;
  onEnterGrades: (exam: ExamRow) => void;
}) {
  const { t, locale } = useLanguage();
  const head = group?.exams[0] ?? null;
  const style = head ? subjectStyle(head.subjectName) : null;
  const Icon = style?.icon;

  return (
    <Sheet open={Boolean(group)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent closeLabel={t("common.close")}>
        {group && head && style && Icon && (
          <>
            <div className="border-b border-primary-100 bg-gradient-to-br from-primary-50 via-surface to-emerald-50 px-6 pb-5 pt-8">
              <div className="flex items-start gap-4 pe-6">
                <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl", style.badge)}>
                  <Icon className="h-7 w-7" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <SheetTitle className="text-xl font-bold leading-tight text-foreground">
                    {head.title}
                  </SheetTitle>
                  <SheetDescription className="mt-2 flex flex-wrap items-center gap-1.5">
                    {isExamKind(head.kind) && (
                      <span className={pill}>{t(`exams.kind.${head.kind}` as TranslationKey)}</span>
                    )}
                    <span className={pill}>{head.term}</span>
                    <ExamStatusBadge status={head.status} />
                  </SheetDescription>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <dl className="divide-y divide-border/70">
                <Row label={t("teachers.subject")}>{head.subjectName}</Row>
                <Row label={t("exams.examDate")}>
                  <span className="capitalize">
                    {formatDateIn(locale, head.date, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </Row>
                <Row label={t("exams.startTime")}>
                  {head.startMinutes != null ? minutesToTime(head.startMinutes) : "—"}
                </Row>
                <Row label={t("exams.durationMinutes")}>
                  {head.durationMinutes != null
                    ? t("exams.minutes").replace("{n}", String(head.durationMinutes))
                    : "—"}
                </Row>
                <Row label={t("exams.maxScore")}>{head.maxScore}</Row>
                <Row label={t("exams.coefficient")}>
                  {[...new Set(group.exams.map((e) => e.coefficient))].join(" / ")}
                </Row>
              </dl>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-700">
                  {t("exams.sectionInstructions")}
                </h3>
                <p
                  className={cn(
                    "mt-2 whitespace-pre-line rounded-xl bg-surface-muted/50 px-4 py-3 text-sm",
                    head.instructions ? "text-foreground/80" : "text-foreground/40",
                  )}
                >
                  {head.instructions || t("exams.noInstructions")}
                </p>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-700">
                  {t("exams.classesGrading")}
                </h3>
                <ul className="mt-2 space-y-2">
                  {group.exams.map((e) => (
                    <li
                      key={e.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border px-3.5 py-2.5"
                    >
                      <span className="min-w-[3.5rem] font-semibold text-foreground">{e.className}</span>
                      <GradingBadge gradedCount={e.gradedCount} studentCount={e.studentCount} />
                      <span className="text-xs text-foreground/55">
                        {t("exams.colAverage")} :{" "}
                        <span className="font-semibold text-primary-800">
                          {e.average != null ? `${e.average.toFixed(2)} / ${e.maxScore}` : "—"}
                        </span>
                      </span>
                      <Button size="sm" variant="secondary" className="ms-auto" onClick={() => onEnterGrades(e)}>
                        <PenLine className="h-4 w-4" />
                        {t("exams.enterGradesTitle")}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {canManage && (
              <div className="border-t border-border px-6 py-4">
                <Button className="w-full" onClick={() => onEdit(head)}>
                  <Pencil className="h-4 w-4" />
                  {t("common.edit")}
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
