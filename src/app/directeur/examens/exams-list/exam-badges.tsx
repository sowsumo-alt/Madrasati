"use client";

import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { subjectStyle } from "@/components/subjects/subject-style";
import { isFullyGraded } from "@/lib/exam-groups";
import type { ExamStatus } from "@/lib/exams";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<ExamStatus, string> = {
  PLANNED: "bg-blue-50 text-blue-700",
  ONGOING: "bg-amber-50 text-amber-700",
  DONE: "bg-emerald-50 text-emerald-700",
};

/** « Planifié », « En cours » ou « Terminé », avec les couleurs de la maquette. */
export function ExamStatusBadge({ status }: { status: ExamStatus }) {
  const { t } = useLanguage();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        STATUS_STYLE[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {t(`exams.status.${status}` as TranslationKey)}
    </span>
  );
}

/** Avancement de la saisie : « Complet » dès que chaque élève a une note ou une absence. */
export function GradingBadge({
  gradedCount,
  studentCount,
}: {
  gradedCount: number;
  studentCount: number;
}) {
  const { t } = useLanguage();

  // dir="ltr" : sans lui, l'arabe affiche « 0 / 24 » à l'envers, « 24 / 0 ».
  const count = (
    <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums" }}>
      {gradedCount} / {studentCount}
    </span>
  );

  if (isFullyGraded({ gradedCount, studentCount })) {
    return (
      <Badge variant="success" className="whitespace-nowrap">
        <CheckCircle2 className="me-1 inline h-3 w-3" strokeWidth={2.5} />
        {/* La coche verte suffit à l'œil ; le mot reste pour les lecteurs d'écran. */}
        <span className="sr-only">{t("exams.complete")} · </span>
        {count}
      </Badge>
    );
  }
  return (
    <Badge variant={gradedCount === 0 ? "neutral" : "warning"} className="whitespace-nowrap">
      {count}
    </Badge>
  );
}

/** Matière avec son icône et sa couleur, les mêmes que sur l'emploi du temps. */
export function SubjectChip({ name }: { name: string }) {
  const style = subjectStyle(name);
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex max-w-[12rem] items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        style.chip,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  );
}
