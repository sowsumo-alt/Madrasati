"use client";

import { Fragment, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  MoreVertical,
  PenLine,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExamGroup } from "@/lib/exam-groups";
import { isExamKind } from "@/lib/exams";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import type { ExamRow } from "../exams-view";
import { ExamStatusBadge, GradingBadge, SubjectChip } from "./exam-badges";
import { formatExamDate } from "./format-exam-date";

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/55 transition-colors hover:bg-surface-muted hover:text-primary-700"
    >
      {children}
    </button>
  );
}

/**
 * Actions d'une ligne : voir, modifier, et dans le menu la saisie des notes et
 * la suppression.
 *
 * Défini au niveau du module et non dans le tableau : un composant déclaré à
 * l'intérieur d'un autre est un type neuf à chaque rendu, que React démonte et
 * remonte entièrement — un menu ouvert se refermerait aussitôt.
 */
function RowActions({
  exam,
  gradeTargets,
  canManage,
  onView,
  onEdit,
  onEnterGrades,
  onDelete,
}: {
  exam: ExamRow;
  /** Examens à noter depuis la ligne : sa classe, ou chaque classe d'un examen commun. */
  gradeTargets: ExamRow[];
  canManage: boolean;
  onView?: () => void;
  onEdit: (exam: ExamRow) => void;
  onEnterGrades: (exam: ExamRow) => void;
  onDelete: (exam: ExamRow) => void;
}) {
  const { t } = useLanguage();

  // Enseignant sur une seule classe : la saisie reste un bouton visible, c'est
  // son geste de tous les jours.
  if (!canManage && gradeTargets.length === 1) {
    return (
      <div className="flex items-center justify-end gap-0.5">
        {onView && (
          <IconButton label={t("exams.view")} onClick={onView}>
            <Eye className="h-4 w-4" />
          </IconButton>
        )}
        <button
          type="button"
          onClick={() => onEnterGrades(exam)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-50"
        >
          <PenLine className="h-4 w-4" />
          <span className="hidden sm:inline">{t("exams.enterGradesTitle")}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-0.5">
      {onView && (
        <IconButton label={t("exams.view")} onClick={onView}>
          <Eye className="h-4 w-4" />
        </IconButton>
      )}
      {canManage && (
        <IconButton label={t("common.edit")} onClick={() => onEdit(exam)}>
          <Pencil className="h-4 w-4" />
        </IconButton>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t("common.actions")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/55 transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[14rem]">
          {gradeTargets.map((e) => (
            <DropdownMenuItem key={e.id} onClick={() => onEnterGrades(e)}>
              <PenLine className="h-4 w-4 text-primary-600" />
              {gradeTargets.length > 1
                ? `${t("exams.enterGradesTitle")} — ${e.className}`
                : t("exams.enterGradesTitle")}
            </DropdownMenuItem>
          ))}
          {canManage && (
            <DropdownMenuItem onClick={() => onDelete(exam)} className="text-danger">
              <Trash2 className="h-4 w-4" />
              {t("exams.delete")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const classChip =
  "inline-flex whitespace-nowrap rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700";

/**
 * Tableau des examens (cartes sur téléphone). Un examen commun à plusieurs
 * classes forme une seule ligne numérotée, dépliable classe par classe :
 * « Composition Trimestre 1 » planifiée pour six classes ne fait plus six
 * lignes identiques.
 */
export function ExamsTable({
  groups,
  startIndex,
  canManage,
  isCollapsed,
  onToggle,
  onView,
  onEdit,
  onEnterGrades,
  onDelete,
}: {
  groups: ExamGroup<ExamRow>[];
  /** Rang du premier examen de la page, pour une numérotation continue. */
  startIndex: number;
  canManage: boolean;
  isCollapsed: (key: string) => boolean;
  onToggle: (key: string) => void;
  onView: (group: ExamGroup<ExamRow>) => void;
  onEdit: (exam: ExamRow) => void;
  onEnterGrades: (exam: ExamRow) => void;
  onDelete: (exam: ExamRow) => void;
}) {
  const { t, locale } = useLanguage();

  /** « Contrôle · Trimestre 1 · sur 20 » */
  const details = (e: ExamRow) =>
    [
      isExamKind(e.kind) ? t(`exams.kind.${e.kind}` as TranslationKey) : null,
      e.term,
      `${t("exams.outOf")} ${e.maxScore}`,
    ]
      .filter(Boolean)
      .join(" · ");
  const sharedLabel = (group: ExamGroup<ExamRow>) =>
    t("exams.sharedClasses").replace("{n}", String(group.exams.length));
  // Sans dir="ltr", l'arabe inverse « 15/09/2026 08:00 » en « 08:00 2026/09/15 ».
  const examDate = (e: ExamRow) => (
    <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatExamDate(locale, e.date, e.startMinutes)}
    </span>
  );

  return (
    <>
      <ul className="divide-y divide-border/70 md:hidden">
        {groups.map((group, index) => {
          const head = group.exams[0];
          return (
            <li key={group.key} className="flex gap-3 px-4 py-3.5">
              <span className="w-5 shrink-0 pt-0.5 text-xs text-foreground/40">{startIndex + index + 1}</span>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => onView(group)} className="block text-start">
                  <span className="block font-semibold text-foreground">{head.title}</span>
                  <span className="mt-0.5 block text-xs text-foreground/50">{details(head)}</span>
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {group.isShared ? (
                    <button type="button" onClick={() => onView(group)} className={classChip}>
                      {sharedLabel(group)}
                    </button>
                  ) : (
                    <span className={classChip}>{head.className}</span>
                  )}
                  <SubjectChip name={head.subjectName} />
                  <ExamStatusBadge status={head.status} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-foreground/60">
                    {examDate(head)}
                    <GradingBadge
                      gradedCount={group.exams.reduce((n, e) => n + e.gradedCount, 0)}
                      studentCount={group.exams.reduce((n, e) => n + e.studentCount, 0)}
                    />
                  </div>
                  <RowActions
                    exam={head}
                    gradeTargets={group.exams}
                    canManage={canManage}
                    onEdit={onEdit}
                    onEnterGrades={onEnterGrades}
                    onDelete={onDelete}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/60 text-xs font-semibold uppercase tracking-wide text-foreground/50">
              <th className="w-12 px-4 py-3 text-start">{t("exams.colNumber")}</th>
              <th className="px-3 py-3 text-start">{t("exams.colName")}</th>
              <th className="px-3 py-3 text-start">{t("students.class")}</th>
              <th className="hidden px-3 py-3 text-start xl:table-cell">{t("teachers.subject")}</th>
              <th className="px-3 py-3 text-start">{t("exams.date")}</th>
              <th className="hidden px-3 py-3 text-start min-[90rem]:table-cell">{t("exams.colGraded")}</th>
              <th className="px-3 py-3 text-start">{t("students.status")}</th>
              <th className="px-4 py-3 text-end">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {groups.map((group, index) => {
              const head = group.exams[0];
              const folded = isCollapsed(group.key);
              const graded = group.exams.reduce((n, e) => n + e.gradedCount, 0);
              const total = group.exams.reduce((n, e) => n + e.studentCount, 0);

              return (
                <Fragment key={group.key}>
                  <tr className="transition-colors hover:bg-surface-muted/40">
                    <td className="px-4 py-3 text-foreground/45" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {startIndex + index + 1}
                    </td>
                    <td className="px-3 py-3">
                      <button type="button" onClick={() => onView(group)} className="group text-start">
                        <span className="block font-semibold text-foreground transition-colors group-hover:text-primary-700">
                          {head.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-foreground/50">
                          {details(head)}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      {group.isShared ? (
                        <button
                          type="button"
                          onClick={() => onToggle(group.key)}
                          aria-expanded={!folded}
                          className={`${classChip} items-center gap-1 transition-colors hover:bg-primary-100`}
                        >
                          {folded ? (
                            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                          {sharedLabel(group)}
                        </button>
                      ) : (
                        <span className={classChip}>{head.className}</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-3 xl:table-cell">
                      <SubjectChip name={head.subjectName} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-foreground/70">{examDate(head)}</td>
                    <td className="hidden px-3 py-3 min-[90rem]:table-cell">
                      <GradingBadge gradedCount={graded} studentCount={total} />
                    </td>
                    <td className="px-3 py-3">
                      <ExamStatusBadge status={head.status} />
                    </td>
                    <td className="px-4 py-3">
                      <RowActions
                        exam={head}
                        gradeTargets={group.exams}
                        canManage={canManage}
                        onView={() => onView(group)}
                        onEdit={onEdit}
                        onEnterGrades={onEnterGrades}
                        onDelete={onDelete}
                      />
                    </td>
                  </tr>

                  {group.isShared &&
                    !folded &&
                    group.exams.map((e) => (
                      <tr key={e.id} className="bg-surface-muted/20 transition-colors hover:bg-surface-muted/40">
                        <td className="px-4 py-2.5" />
                        <td className="px-3 py-2.5">
                          <span className="ms-1 block border-s-2 border-border ps-3 text-xs text-foreground/45">
                            {t("exams.sameExam")}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex whitespace-nowrap rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-foreground/80 ring-1 ring-border">
                            {e.className}
                          </span>
                        </td>
                        <td className="hidden px-3 py-2.5 xl:table-cell" />
                        <td className="px-3 py-2.5" />
                        <td className="hidden px-3 py-2.5 min-[90rem]:table-cell">
                          <GradingBadge gradedCount={e.gradedCount} studentCount={e.studentCount} />
                        </td>
                        <td className="px-3 py-2.5" />
                        <td className="px-4 py-2.5">
                          <RowActions
                            exam={e}
                            gradeTargets={[e]}
                            canManage={canManage}
                            onEdit={onEdit}
                            onEnterGrades={onEnterGrades}
                            onDelete={onDelete}
                          />
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
