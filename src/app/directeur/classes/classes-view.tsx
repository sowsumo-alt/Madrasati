"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Plus, RefreshCw, Sparkles, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  classTone,
  mainTeacherCount,
  matchesClassFilters,
  type ClassFilter,
} from "@/lib/classes-list";
import { useLanguage } from "@/lib/i18n/language-provider";
import {
  ClassFormDialog,
  type ClassEditTarget,
  type ClassTeacherOption,
} from "./class-form-dialog";
import {
  ClassAssignmentsDialog,
  type AssignmentSubject,
  type AssignmentTeacher,
  type ClassAssignmentsTarget,
} from "./class-assignments-dialog";
import { SubjectFormDialog, type SubjectEditTarget } from "./subject-form-dialog";
import { StandardClassesDialog } from "./standard-classes-dialog";
import { deleteClass, deleteSubject, setSubjectActive } from "./actions";
import { SectionPanel, sectionButton } from "./classes-list/section-panel";
import { ClassesKpis } from "./classes-list/classes-kpis";
import { ClassesToolbar } from "./classes-list/classes-toolbar";
import { ClassesTable, type ClassTableRow } from "./classes-list/classes-table";
import { ClassDetailSheet } from "./classes-list/class-detail-sheet";
import { SubjectsTable } from "./classes-list/subjects-table";

export interface ClassRow {
  id: string;
  name: string;
  level: string;
  capacity: number;
  studentCount: number;
  mainTeacher: { id: string; firstName: string; lastName: string } | null;
  assignments: { subjectId: string; subjectName: string; teacherId: string | null; teacherName: string | null }[];
}

export interface SubjectRow {
  id: string;
  name: string;
  nameAr: string | null;
  coefficient: number;
  isActive: boolean;
  /** Examens déjà passés dans cette matière : au-delà de zéro, on la
   *  désactive plutôt que de la supprimer (voir deleteSubject). */
  examCount: number;
}

export function ClassesView({
  classes,
  subjects,
  teachers,
  studentTotal,
}: {
  classes: ClassRow[];
  subjects: SubjectRow[];
  teachers: ClassTeacherOption[];
  /** Élèves actifs de l'école, classés ou non. */
  studentTotal: number;
}) {
  const router = useRouter();
  const { t } = useLanguage();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ClassFilter>("ALL");

  const [classFormOpen, setClassFormOpen] = useState(false);
  const [classEditTarget, setClassEditTarget] = useState<ClassEditTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [assignmentsClassId, setAssignmentsClassId] = useState<string | null>(null);

  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [subjectEditTarget, setSubjectEditTarget] = useState<SubjectEditTarget | null>(null);
  const [subjectDeleteTarget, setSubjectDeleteTarget] = useState<SubjectRow | null>(null);
  const [subjectDeleteLoading, setSubjectDeleteLoading] = useState(false);
  const [standardClassesOpen, setStandardClassesOpen] = useState(false);

  // La couleur suit la place dans la liste complète, pas dans la liste
  // filtrée : une classe garde sa teinte pendant une recherche.
  const tableRows: ClassTableRow[] = useMemo(
    () => classes.map((row, index) => ({ row, tone: classTone(index) })),
    [classes],
  );
  const visibleRows = tableRows.filter(({ row }) => matchesClassFilters(row, query, filter));
  const detailTarget = tableRows.find(({ row }) => row.id === detailId) ?? null;

  const assignmentsClass = classes.find((c) => c.id === assignmentsClassId) ?? null;
  const assignmentsTarget: ClassAssignmentsTarget | null = assignmentsClass
    ? {
        classId: assignmentsClass.id,
        className: assignmentsClass.name,
        assignments: assignmentsClass.assignments.map((a) => ({
          subjectId: a.subjectId,
          teacherId: a.teacherId,
        })),
      }
    : null;

  const activeSubjects = subjects.filter((s) => s.isActive);
  const assignmentSubjects: AssignmentSubject[] = activeSubjects.map((s) => ({ id: s.id, name: s.name }));
  const assignmentTeachers: AssignmentTeacher[] = teachers;

  function openClassForm(row: ClassRow | null) {
    setClassEditTarget(
      row
        ? {
            id: row.id,
            name: row.name,
            level: row.level,
            capacity: row.capacity,
            mainTeacherId: row.mainTeacher?.id ?? null,
          }
        : null,
    );
    setClassFormOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteClass(deleteTarget.id);
      toast.success(t("classes.deleted"));
      setDeleteTarget(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleSubjectDelete() {
    const subject = subjectDeleteTarget;
    if (!subject) return;
    setSubjectDeleteLoading(true);
    try {
      if (subject.examCount > 0) {
        await setSubjectActive(subject.id, false);
        toast.success(t("classes.subjectDeactivated"));
      } else {
        await deleteSubject(subject.id);
        toast.success(t("classes.subjectDeleted"));
      }
      setSubjectDeleteTarget(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSubjectDeleteLoading(false);
    }
  }

  async function handleReactivate(subject: SubjectRow) {
    try {
      await setSubjectActive(subject.id, true);
      toast.success(t("classes.subjectReactivated"));
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    }
  }

  const deactivating = (subjectDeleteTarget?.examCount ?? 0) > 0;

  return (
    <div className="space-y-6">
      <SectionPanel
        icon={UsersRound}
        title={t("classes.classesTitle")}
        subtitle={t("classes.classesSubtitle")}
        titleAs="h1"
        actions={
          <>
            <Button variant="secondary" className={sectionButton.secondary} onClick={() => setStandardClassesOpen(true)}>
              <RefreshCw className="h-4 w-4 text-primary-600" />
              {t("classes.autoShort")}
            </Button>
            <Button className={sectionButton.primary} onClick={() => openClassForm(null)}>
              <Plus className="h-4 w-4" />
              {t("classes.newClass")}
            </Button>
          </>
        }
      >
        <div className="mt-5 space-y-4">
          <ClassesKpis
            values={{
              classes: classes.length,
              students: studentTotal,
              mainTeachers: mainTeacherCount(classes),
              subjects: activeSubjects.length,
            }}
          />

          {classes.length === 0 ? (
            <div className="rounded-2xl bg-primary-50/60 px-5 py-12 text-center">
              <p className="text-sm text-foreground/60">{t("classes.empty")}</p>
              <p className="mt-1 text-sm text-foreground/50">{t("classes.emptyHint")}</p>
              <Button className="mt-4" onClick={() => setStandardClassesOpen(true)}>
                <Sparkles className="h-4 w-4" />
                {t("classes.autoCreate")}
              </Button>
            </div>
          ) : (
            <>
              <ClassesToolbar query={query} onQueryChange={setQuery} filter={filter} onFilterChange={setFilter} />
              {visibleRows.length === 0 ? (
                <p className="rounded-2xl bg-primary-50/60 px-5 py-10 text-center text-sm text-foreground/55">
                  {t("classes.noMatch")}
                </p>
              ) : (
                <ClassesTable
                  rows={visibleRows}
                  onEdit={openClassForm}
                  onView={(row) => setDetailId(row.id)}
                  onDelete={setDeleteTarget}
                />
              )}
            </>
          )}
        </div>
      </SectionPanel>

      <SectionPanel
        icon={BookOpen}
        title={t("classes.subjects")}
        subtitle={t("classes.subjectsSubtitle")}
        actions={
          <Button
            className={sectionButton.primary}
            onClick={() => {
              setSubjectEditTarget(null);
              setSubjectFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t("classes.newSubject")}
          </Button>
        }
      >
        <div className="mt-4">
          {subjects.length === 0 ? (
            <p className="rounded-2xl bg-primary-50/60 px-5 py-10 text-center text-sm text-foreground/55">
              {t("classes.subjectsEmpty")}
            </p>
          ) : (
            <SubjectsTable
              subjects={subjects}
              onEdit={(s) => {
                setSubjectEditTarget(s);
                setSubjectFormOpen(true);
              }}
              onDelete={setSubjectDeleteTarget}
              onReactivate={handleReactivate}
            />
          )}
        </div>
      </SectionPanel>

      <ClassDetailSheet
        target={detailTarget}
        onClose={() => setDetailId(null)}
        onManageSubjects={(row) => {
          setDetailId(null);
          setAssignmentsClassId(row.id);
        }}
      />
      <ClassFormDialog
        open={classFormOpen}
        onOpenChange={setClassFormOpen}
        teachers={teachers}
        editTarget={classEditTarget}
      />
      <StandardClassesDialog open={standardClassesOpen} onOpenChange={setStandardClassesOpen} />
      <ClassAssignmentsDialog
        target={assignmentsTarget}
        onOpenChange={(open) => !open && setAssignmentsClassId(null)}
        subjects={assignmentSubjects}
        teachers={assignmentTeachers}
      />
      <SubjectFormDialog
        open={subjectFormOpen}
        onOpenChange={setSubjectFormOpen}
        editTarget={subjectEditTarget}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("classes.deleteTitle")}
        description={t("classes.deleteHint")}
        confirmLabel={t("classes.deleteClass")}
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={Boolean(subjectDeleteTarget)}
        onOpenChange={(open) => !open && setSubjectDeleteTarget(null)}
        title={deactivating ? t("classes.deactivateSubjectTitle") : t("classes.deleteSubjectTitle")}
        description={deactivating ? t("classes.deactivateSubjectHint") : t("classes.deleteSubjectHint")}
        confirmLabel={deactivating ? t("classes.deactivate") : t("classes.deleteSubject")}
        variant={deactivating ? "primary" : "danger"}
        loading={subjectDeleteLoading}
        onConfirm={handleSubjectDelete}
      />
    </div>
  );
}
