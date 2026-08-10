"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { deleteClass, setSubjectActive } from "./actions";

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
  coefficient: number;
  isActive: boolean;
}

export function ClassesView({
  classes,
  subjects,
  teachers,
}: {
  classes: ClassRow[];
  subjects: SubjectRow[];
  teachers: ClassTeacherOption[];
}) {
  const router = useRouter();

  const [classFormOpen, setClassFormOpen] = useState(false);
  const [classEditTarget, setClassEditTarget] = useState<ClassEditTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [assignmentsClassId, setAssignmentsClassId] = useState<string | null>(null);
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

  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [subjectEditTarget, setSubjectEditTarget] = useState<SubjectEditTarget | null>(null);

  const assignmentSubjects: AssignmentSubject[] = subjects
    .filter((s) => s.isActive)
    .map((s) => ({ id: s.id, name: s.name }));
  const assignmentTeachers: AssignmentTeacher[] = teachers;

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteClass(deleteTarget.id);
      toast.success("Classe supprimée.");
      setDeleteTarget(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleToggleSubject(subject: SubjectRow) {
    try {
      await setSubjectActive(subject.id, !subject.isActive);
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue.");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Classes & Matières</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Organisez les classes de l&apos;école et les matières enseignées.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Classes</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setClassEditTarget(null);
              setClassFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nouvelle classe
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {classes.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-foreground/50">
              Aucune classe pour l&apos;instant.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                    <th className="px-5 py-3">Classe</th>
                    <th className="px-5 py-3">Niveau</th>
                    <th className="px-5 py-3">Élèves</th>
                    <th className="px-5 py-3">Prof. principal</th>
                    <th className="px-5 py-3">Matières</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {classes.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-muted/40">
                      <td className="px-5 py-3 font-medium text-foreground">{c.name}</td>
                      <td className="px-5 py-3 text-foreground/70">{c.level}</td>
                      <td className="px-5 py-3 text-foreground/70">
                        {c.studentCount} / {c.capacity}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {c.mainTeacher ? (
                          `${c.mainTeacher.firstName} ${c.mainTeacher.lastName}`
                        ) : (
                          <span className="text-foreground/40">Aucun</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {c.assignments.length} matière(s)
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="Matières & enseignants"
                            onClick={() => setAssignmentsClassId(c.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-700 transition-colors hover:bg-primary-50"
                          >
                            <BookOpen className="h-4 w-4" />
                          </button>
                          <button
                            title="Modifier"
                            onClick={() => {
                              setClassEditTarget({
                                id: c.id,
                                name: c.name,
                                level: c.level,
                                capacity: c.capacity,
                                mainTeacherId: c.mainTeacher?.id ?? null,
                              });
                              setClassFormOpen(true);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            title="Supprimer"
                            onClick={() => setDeleteTarget(c)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-red-50 hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Matières</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setSubjectEditTarget(null);
              setSubjectFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nouvelle matière
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">Matière</th>
                  <th className="px-5 py-3">Coefficient</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subjects.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-muted/40">
                    <td className="px-5 py-3 font-medium text-foreground">{s.name}</td>
                    <td className="px-5 py-3 text-foreground/70">{s.coefficient}</td>
                    <td className="px-5 py-3">
                      <Badge variant={s.isActive ? "success" : "neutral"}>
                        {s.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Modifier"
                          onClick={() => {
                            setSubjectEditTarget(s);
                            setSubjectFormOpen(true);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleToggleSubject(s)}
                        >
                          {s.isActive ? "Désactiver" : "Activer"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ClassFormDialog
        open={classFormOpen}
        onOpenChange={setClassFormOpen}
        teachers={teachers}
        editTarget={classEditTarget}
      />
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
        title="Supprimer cette classe ?"
        description="Cette action est irréversible. Impossible si des élèves y sont encore inscrits."
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </div>
  );
}
