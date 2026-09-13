"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListPagination } from "@/components/ui/list-pagination";
import { groupExams } from "@/lib/exam-groups";
import type { ExamStatus } from "@/lib/exams";
import { useLanguage } from "@/lib/i18n/language-provider";
import {
  ExamFormDialog,
  type ExamClassOption,
  type ExamEditTarget,
} from "./exam-form-dialog";
import { ScopeChoice } from "./scope-choice";
import { GradesDialog, type GradesDialogStudent } from "./grades-dialog";
import { deleteExam } from "./actions";
import type { ExamScope } from "./schema";
import { ExamsToolbar } from "./exams-list/exams-toolbar";
import { ExamsTable } from "./exams-list/exams-table";
import { ExamDetailSheet } from "./exams-list/exam-detail-sheet";

export interface ExamRow {
  id: string;
  title: string;
  /** Type d'examen (voir EXAM_KINDS) ; absent pour les examens planifiés avant ce champ. */
  kind: string | null;
  term: string;
  /** Jour ISO, à minuit UTC. */
  date: string;
  startMinutes: number | null;
  durationMinutes: number | null;
  instructions: string | null;
  maxScore: number;
  /** Coefficient appliqué sur le bulletin de la classe. */
  coefficient: number;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  /** Calculé côté serveur (voir exam-rows.ts). */
  status: ExamStatus;
  gradedCount: number;
  studentCount: number;
  average: number | null;
  students: GradesDialogStudent[];
}

// Dix examens — ou examens communs à plusieurs classes — par page.
const PAGE_SIZE = 10;

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
  const [query, setQuery] = useState("");
  const [termFilter, setTermFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExamEditTarget | null>(null);
  const [gradesExamId, setGradesExamId] = useState<string | null>(initialExamId);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExamRow | null>(null);
  const [deleteScope, setDeleteScope] = useState<ExamScope>("one");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const subjects = useMemo(() => {
    const names = new Map<string, string>();
    for (const e of exams) names.set(e.subjectId, e.subjectName);
    for (const c of classes) for (const s of c.subjects) names.set(s.id, s.name);
    return [...names.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [exams, classes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exams.filter(
      (e) =>
        (termFilter === "ALL" || e.term === termFilter) &&
        (classFilter === "ALL" || e.classId === classFilter) &&
        (subjectFilter === "ALL" || e.subjectId === subjectFilter) &&
        (!q || `${e.title} ${e.subjectName} ${e.className}`.toLowerCase().includes(q)),
    );
  }, [exams, query, termFilter, classFilter, subjectFilter]);

  // Les examens communs à plusieurs classes sont réunis sous une même ligne :
  // « Composition Trimestre 1 » planifiée pour six classes formait six lignes
  // identiques que rien ne rattachait entre elles.
  const groups = useMemo(() => groupExams(filtered), [filtered]);
  const pageCount = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageGroups = groups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Groupes calculés sur tous les examens, filtres ignorés : filtrer sur une
  // classe ne doit pas faire croire qu'un examen commun n'en concerne qu'une
  // au moment de le modifier ou de le supprimer.
  const allGroups = useMemo(() => groupExams(exams), [exams]);

  // Un lien direct vers la saisie des notes doit aussi déplier la ligne qui
  // contient cet examen, sinon la classe visée reste cachée une fois la
  // saisie fermée.
  const openedGroupKey = useMemo(() => {
    if (!initialExamId) return null;
    return allGroups.find((g) => g.exams.some((e) => e.id === initialExamId))?.key ?? null;
  }, [allGroups, initialExamId]);

  // Replié par défaut : c'est ce qui règle l'encombrement de la liste.
  const isCollapsed = (key: string) => collapsed[key] ?? key !== openedGroupKey;

  const gradesExam = exams.find((e) => e.id === gradesExamId) ?? null;
  const detailGroup = allGroups.find((g) => g.key === detailKey) ?? null;

  // Le lien ?exam=… n'a de sens qu'au chargement : on le retire de l'URL pour
  // que le bouton « précédent » ne rouvre pas la saisie en boucle.
  useEffect(() => {
    if (initialExamId) router.replace(window.location.pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialExamId]);

  function classCountOf(examId: string) {
    return allGroups.find((g) => g.exams.some((e) => e.id === examId))?.exams.length ?? 1;
  }

  /** Tout changement de filtre ramène à la première page. */
  function onFilter(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  }

  function openEdit(e: ExamRow) {
    setDetailKey(null);
    setEditTarget({
      examId: e.id,
      classId: e.classId,
      className: e.className,
      subjectId: e.subjectId,
      subjectName: e.subjectName,
      title: e.title,
      kind: e.kind,
      term: e.term,
      date: e.date,
      startMinutes: e.startMinutes,
      durationMinutes: e.durationMinutes,
      instructions: e.instructions,
      maxScore: e.maxScore,
      coefficient: e.coefficient,
      classCount: classCountOf(e.id),
    });
  }

  function openGrades(e: ExamRow) {
    setDetailKey(null);
    setGradesExamId(e.id);
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
  const from = (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(currentPage * PAGE_SIZE, groups.length);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav
            aria-label={t("nav.category.pedagogy")}
            className="mb-1.5 flex items-center gap-1.5 text-xs text-foreground/50"
          >
            <span>{t("nav.category.pedagogy")}</span>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <span className="font-medium text-foreground/70">{t("nav.exams")}</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("exams.title")}</h1>
          <p className="mt-1 text-sm text-foreground/60">
            {canManageExams ? t("exams.subtitleDirector") : t("exams.subtitleTeacher")}
          </p>
        </div>
        {canManageExams && (
          <Button className="h-11 px-5 shadow-sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            {t("exams.newExam")}
          </Button>
        )}
      </div>

      <ExamsToolbar
        query={query}
        onQueryChange={onFilter(setQuery)}
        term={termFilter}
        onTermChange={onFilter(setTermFilter)}
        classFilter={classFilter}
        onClassFilterChange={onFilter(setClassFilter)}
        subjectFilter={subjectFilter}
        onSubjectFilterChange={onFilter(setSubjectFilter)}
        classes={classes}
        subjects={subjects}
      />

      <section className="overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-soft">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{t("exams.listTitle")}</h2>
        </div>
        {groups.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-foreground/50">
            {exams.length === 0 ? t("exams.none") : t("exams.noneMatching")}
          </div>
        ) : (
          <>
            <ExamsTable
              groups={pageGroups}
              startIndex={(currentPage - 1) * PAGE_SIZE}
              canManage={canManageExams}
              isCollapsed={isCollapsed}
              onToggle={(key) => setCollapsed((c) => ({ ...c, [key]: !isCollapsed(key) }))}
              onView={(group) => setDetailKey(group.key)}
              onEdit={openEdit}
              onEnterGrades={openGrades}
              onDelete={openDelete}
            />
            <ListPagination
              page={currentPage}
              pageCount={pageCount}
              summary={t("exams.showing")
                .replace("{from}", String(from))
                .replace("{to}", String(to))
                .replace("{total}", String(groups.length))}
              previousLabel={t("students.previousPage")}
              nextLabel={t("students.nextPage")}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      <ExamDetailSheet
        group={detailGroup}
        canManage={canManageExams}
        onClose={() => setDetailKey(null)}
        onEdit={openEdit}
        onEnterGrades={openGrades}
      />
      {canManageExams && (
        <ExamFormDialog
          open={formOpen || Boolean(editTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setFormOpen(false);
              setEditTarget(null);
            }
          }}
          classes={classes}
          editTarget={editTarget}
        />
      )}
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
