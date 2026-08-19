"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, PenLine, Trash2, Pencil, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ExamFormDialog, type ExamClassOption } from "./exam-form-dialog";
import { ExamEditDialog, type ExamEditTarget } from "./exam-edit-dialog";
import { ScopeChoice } from "./scope-choice";
import { GradesDialog, type GradesDialogStudent } from "./grades-dialog";
import { deleteExam } from "./actions";
import { formatDate } from "@/lib/format";
import { TERMS, type ExamScope } from "./schema";
import { groupExams, isFullyGraded } from "@/lib/exam-groups";
import { useLanguage } from "@/lib/i18n/language-provider";

export interface ExamRow {
  id: string;
  title: string;
  term: string;
  date: string;
  durationMinutes: number | null;
  maxScore: number;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  gradedCount: number;
  studentCount: number;
  average: number | null;
  students: GradesDialogStudent[];
}

/**
 * Boutons d'action d'une ligne de classe.
 *
 * Défini au niveau du module et non dans ExamsView : un composant déclaré à
 * l'intérieur d'un autre est un type neuf à chaque rendu, que React démonte et
 * remonte entièrement — le bouton perdrait le focus à chaque frappe dans la
 * page.
 */
function RowActions({
  exam,
  canManage,
  onEnterGrades,
  onEdit,
  onDelete,
}: {
  exam: ExamRow;
  canManage: boolean;
  onEnterGrades: (exam: ExamRow) => void;
  onEdit: (exam: ExamRow) => void;
  onDelete: (exam: ExamRow) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        title={t("exams.enterGradesTitle")}
        onClick={() => onEnterGrades(exam)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-50"
      >
        <PenLine className="h-4 w-4" />
        <span className="hidden sm:inline">{t("exams.enterGradesTitle")}</span>
      </button>
      {canManage && (
        <>
          <button
            title={t("common.edit")}
            onClick={() => onEdit(exam)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            title={t("exams.delete")}
            onClick={() => onDelete(exam)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-red-50 hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}

/** Avancement de la saisie : « Complet » dès que chaque élève a une note ou une absence. */
function GradingBadge({
  gradedCount,
  studentCount,
}: {
  gradedCount: number;
  studentCount: number;
}) {
  const { t } = useLanguage();
  const done = isFullyGraded({ gradedCount, studentCount });

  if (done) {
    return (
      <Badge variant="success">
        <CheckCircle2 className="mr-1 inline h-3 w-3" strokeWidth={2.5} />
        {t("exams.complete")} · {gradedCount}/{studentCount}
      </Badge>
    );
  }
  return (
    <Badge variant={gradedCount === 0 ? "neutral" : "warning"}>
      {gradedCount} / {studentCount}
    </Badge>
  );
}

export function ExamsView({
  exams,
  classes,
  canManageExams = true,
  schoolName,
  bilingual,
  initialExamId = null,
}: {
  exams: ExamRow[];
  classes: ExamClassOption[];
  /** L'enseignant saisit les notes mais ne crée ni ne supprime les examens. */
  canManageExams?: boolean;
  schoolName: string;
  bilingual: boolean;
  /** Examen à ouvrir directement en saisie de notes (lien ?exam=…). */
  initialExamId?: string | null;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [termFilter, setTermFilter] = useState<string>("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [gradesExamId, setGradesExamId] = useState<string | null>(initialExamId);
  const [editTarget, setEditTarget] = useState<ExamEditTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExamRow | null>(null);
  const [deleteScope, setDeleteScope] = useState<ExamScope>("one");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(
    () => (termFilter === "ALL" ? exams : exams.filter((e) => e.term === termFilter)),
    [exams, termFilter],
  );

  // Les examens communs à plusieurs classes sont réunis sous un même bloc :
  // « Composition Trimestre 1 » planifiée pour six classes formait six lignes
  // identiques que rien ne rattachait entre elles.
  const groups = useMemo(() => groupExams(filtered), [filtered]);

  // Un lien direct vers la saisie des notes doit aussi déplier le bloc qui
  // contient cet examen, sinon la ligne visée reste cachée derrière le sien
  // une fois la boîte de dialogue fermée.
  const openedGroupKey = useMemo(() => {
    if (!initialExamId) return null;
    return groups.find((g) => g.exams.some((e) => e.id === initialExamId))?.key ?? null;
  }, [groups, initialExamId]);

  // Replié par défaut : c'est ce qui règle l'encombrement de la liste. Le bloc
  // visé par un lien direct, lui, s'ouvre.
  const isCollapsed = (key: string) =>
    collapsed[key] ?? (key !== openedGroupKey);

  const gradesExam = exams.find((e) => e.id === gradesExamId) ?? null;

  // Le lien ?exam=… n'a de sens qu'au chargement : on le retire de l'URL pour
  // que le bouton « précédent » ne rouvre pas la saisie en boucle.
  useEffect(() => {
    if (initialExamId) router.replace(window.location.pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialExamId]);

  function classCountOf(examId: string) {
    return groups.find((g) => g.exams.some((e) => e.id === examId))?.exams.length ?? 1;
  }

  function openEdit(e: ExamRow) {
    setEditTarget({
      examId: e.id,
      className: e.className,
      subjectName: e.subjectName,
      title: e.title,
      term: e.term,
      date: e.date,
      durationMinutes: e.durationMinutes,
      maxScore: e.maxScore,
      classCount: classCountOf(e.id),
    });
  }

  function openDelete(e: ExamRow) {
    setDeleteScope("one");
    setDeleteTarget(e);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { deleted } = await deleteExam(deleteTarget.id, deleteScope);
      toast.success(
        deleted > 1
          ? t("exams.deletedCount").replace("{n}", String(deleted))
          : t("exams.deleted"),
      );
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setDeleteLoading(false);
    }
  }

  const deleteClassCount = deleteTarget ? classCountOf(deleteTarget.id) : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("exams.title")}</h1>
          <p className="mt-1 text-sm text-foreground/60">
            {canManageExams ? t("exams.subtitleDirector") : t("exams.subtitleTeacher")}
          </p>
        </div>
        {canManageExams && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("exams.newExam")}
          </Button>
        )}
      </div>

      <div className="max-w-xs">
        <Select value={termFilter} onValueChange={setTermFilter}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("exams.allTerms")}</SelectItem>
            {TERMS.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {groups.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-foreground/50">
            {exams.length === 0 ? t("exams.none") : t("exams.noneForTerm")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">{t("exams.colExam")}</th>
                  <th className="px-5 py-3">{t("exams.colClass")}</th>
                  <th className="px-5 py-3">{t("teachers.subject")}</th>
                  <th className="px-5 py-3">{t("exams.date")}</th>
                  <th className="px-5 py-3">{t("exams.colGraded")}</th>
                  <th className="px-5 py-3">{t("exams.colAverage")}</th>
                  <th className="px-5 py-3 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {groups.map((group) => {
                  const head = group.exams[0];

                  // Examen d'une seule classe : rien à regrouper, la ligne
                  // reste exactement celle qu'on connaissait.
                  if (!group.isShared) {
                    return (
                      <tr key={head.id} className="hover:bg-surface-muted/40">
                        <td className="px-5 py-3">
                          <p className="font-medium text-foreground">{head.title}</p>
                          <p className="text-xs text-foreground/40">
                            {head.term} · {t("exams.outOf")} {head.maxScore}
                            {head.durationMinutes ? ` · ${head.durationMinutes} min` : ""}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-foreground/70">{head.className}</td>
                        <td className="px-5 py-3 text-foreground/70">{head.subjectName}</td>
                        <td className="px-5 py-3 text-foreground/70">{formatDate(head.date)}</td>
                        <td className="px-5 py-3">
                          <GradingBadge
                            gradedCount={head.gradedCount}
                            studentCount={head.studentCount}
                          />
                        </td>
                        <td className="px-5 py-3 text-foreground/70">
                          {head.average != null ? (
                            <span className="font-medium text-primary-800">
                              {head.average.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-foreground/30">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <RowActions
                            exam={head}
                            canManage={canManageExams}
                            onEnterGrades={(x) => setGradesExamId(x.id)}
                            onEdit={openEdit}
                            onDelete={openDelete}
                          />
                        </td>
                      </tr>
                    );
                  }

                  const graded = group.exams.reduce((n, e) => n + e.gradedCount, 0);
                  const total = group.exams.reduce((n, e) => n + e.studentCount, 0);
                  const allScores = group.exams.flatMap((e) =>
                    e.average != null ? [{ avg: e.average, n: e.gradedCount }] : [],
                  );
                  // Moyenne de l'examen commun : pondérée par le nombre de
                  // notes de chaque classe, sinon une classe de 5 élèves
                  // pèserait autant qu'une classe de 40.
                  const weight = allScores.reduce((n, s) => n + s.n, 0);
                  const groupAverage =
                    weight > 0
                      ? allScores.reduce((sum, s) => sum + s.avg * s.n, 0) / weight
                      : null;
                  const folded = isCollapsed(group.key);

                  return (
                    <tr key={group.key} className="align-top">
                      <td colSpan={7} className="p-0">
                        <table className="w-full">
                          <tbody>
                            <tr
                              className="cursor-pointer bg-surface-muted/30 hover:bg-surface-muted/60"
                              onClick={() =>
                                setCollapsed((c) => ({ ...c, [group.key]: !folded }))
                              }
                            >
                              <td className="px-5 py-3">
                                <p className="flex items-center gap-1.5 font-medium text-foreground">
                                  <ChevronRight
                                    className={`h-4 w-4 shrink-0 text-foreground/40 transition-transform ${
                                      folded ? "" : "rotate-90"
                                    }`}
                                  />
                                  {head.title}
                                </p>
                                <p className="pl-5.5 text-xs text-foreground/40">
                                  {head.term} · {t("exams.outOf")} {head.maxScore}
                                  {head.durationMinutes ? ` · ${head.durationMinutes} min` : ""}
                                </p>
                              </td>
                              <td className="px-5 py-3">
                                <Badge variant="neutral">
                                  {t("exams.sharedClasses").replace(
                                    "{n}",
                                    String(group.exams.length),
                                  )}
                                </Badge>
                              </td>
                              <td className="px-5 py-3 text-foreground/70">
                                {head.subjectName}
                              </td>
                              <td className="px-5 py-3 text-foreground/70">
                                {formatDate(head.date)}
                              </td>
                              <td className="px-5 py-3">
                                <GradingBadge gradedCount={graded} studentCount={total} />
                              </td>
                              <td className="px-5 py-3 text-foreground/70">
                                {groupAverage != null ? (
                                  <span className="font-medium text-primary-800">
                                    {groupAverage.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-foreground/30">—</span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-right text-xs text-foreground/40">
                                {folded ? t("exams.expand") : t("exams.collapse")}
                              </td>
                            </tr>

                            {!folded &&
                              group.exams.map((e) => (
                                <tr
                                  key={e.id}
                                  className="border-t border-border hover:bg-surface-muted/40"
                                >
                                  <td className="py-3 pl-5">
                                    <span className="ml-1.5 block border-l-2 border-border pl-4 text-xs text-foreground/40">
                                      {t("exams.sameExam")}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3 font-medium text-foreground">
                                    {e.className}
                                  </td>
                                  <td className="px-5 py-3 text-foreground/70">
                                    {e.subjectName}
                                  </td>
                                  <td className="px-5 py-3 text-foreground/70">
                                    {formatDate(e.date)}
                                  </td>
                                  <td className="px-5 py-3">
                                    <GradingBadge
                                      gradedCount={e.gradedCount}
                                      studentCount={e.studentCount}
                                    />
                                  </td>
                                  <td className="px-5 py-3 text-foreground/70">
                                    {e.average != null ? (
                                      <span className="font-medium text-primary-800">
                                        {e.average.toFixed(2)}
                                      </span>
                                    ) : (
                                      <span className="text-foreground/30">—</span>
                                    )}
                                  </td>
                                  <td className="px-5 py-3">
                                    <RowActions
                                      exam={e}
                                      canManage={canManageExams}
                                      onEnterGrades={(x) => setGradesExamId(x.id)}
                                      onEdit={openEdit}
                                      onDelete={openDelete}
                                    />
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExamFormDialog open={formOpen} onOpenChange={setFormOpen} classes={classes} />
      <ExamEditDialog target={editTarget} onOpenChange={(o) => !o && setEditTarget(null)} />
      <GradesDialog
        target={
          gradesExam
            ? {
                examId: gradesExam.id,
                title: gradesExam.title,
                className: gradesExam.className,
                subjectName: gradesExam.subjectName,
                maxScore: gradesExam.maxScore,
                students: gradesExam.students,
              }
            : null
        }
        schoolName={schoolName}
        bilingual={bilingual}
        onOpenChange={(open) => !open && setGradesExamId(null)}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("exams.deleteTitle")}
        description={t("exams.deleteHint")}
        confirmLabel={t("exams.delete")}
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
      >
        {deleteTarget && deleteClassCount > 1 && (
          <ScopeChoice
            value={deleteScope}
            onChange={setDeleteScope}
            classCount={deleteClassCount}
            className={deleteTarget.className}
          />
        )}
      </ConfirmDialog>
    </div>
  );
}
