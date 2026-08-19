"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, PenLine, Trash2 } from "lucide-react";
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
import { GradesDialog, type GradesDialogStudent } from "./grades-dialog";
import { deleteExam } from "./actions";
import { formatDate } from "@/lib/format";
import { TERMS } from "./schema";
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
  subjectName: string;
  gradedCount: number;
  studentCount: number;
  average: number | null;
  students: GradesDialogStudent[];
}

export function ExamsView({
  exams,
  classes,
  canManageExams = true,
  schoolName,
  bilingual,
}: {
  exams: ExamRow[];
  classes: ExamClassOption[];
  /** L'enseignant saisit les notes mais ne crée ni ne supprime les examens. */
  canManageExams?: boolean;
  schoolName: string;
  bilingual: boolean;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [termFilter, setTermFilter] = useState<string>("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [gradesExamId, setGradesExamId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExamRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const filtered = useMemo(
    () => (termFilter === "ALL" ? exams : exams.filter((e) => e.term === termFilter)),
    [exams, termFilter],
  );

  const gradesExam = exams.find((e) => e.id === gradesExamId) ?? null;

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteExam(deleteTarget.id);
      toast.success(t("exams.deleted"));
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Examens & Notes</h1>
          <p className="mt-1 text-sm text-foreground/60">
            {canManageExams
              ? "Planifiez les examens et saisissez les notes de chaque élève."
              : "Saisissez les notes de vos élèves pour chaque examen."}
          </p>
        </div>
        {canManageExams && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouvel examen
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
            {TERMS.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-foreground/50">
            {exams.length === 0
              ? "Aucun examen planifié pour l'instant."
              : "Aucun examen pour ce trimestre."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">Examen</th>
                  <th className="px-5 py-3">Classe</th>
                  <th className="px-5 py-3">{t("teachers.subject")}</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Notes saisies</th>
                  <th className="px-5 py-3">Moyenne</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-muted/40">
                    <td className="px-5 py-3">
                      <p className="font-medium text-foreground">{e.title}</p>
                      <p className="text-xs text-foreground/40">
                        {e.term} · sur {e.maxScore}
                        {e.durationMinutes ? ` · ${e.durationMinutes} min` : ""}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-foreground/70">{e.className}</td>
                    <td className="px-5 py-3 text-foreground/70">{e.subjectName}</td>
                    <td className="px-5 py-3 text-foreground/70">{formatDate(e.date)}</td>
                    <td className="px-5 py-3">
                      <Badge
                        variant={
                          e.gradedCount === 0
                            ? "neutral"
                            : e.gradedCount >= e.studentCount
                              ? "success"
                              : "warning"
                        }
                      >
                        {e.gradedCount} / {e.studentCount}
                      </Badge>
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
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title={t("teacherHome.enterGrades")}
                          onClick={() => setGradesExamId(e.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-700 transition-colors hover:bg-primary-50"
                        >
                          <PenLine className="h-4 w-4" />
                        </button>
                        {canManageExams && (
                          <button
                            title="Supprimer"
                            onClick={() => setDeleteTarget(e)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-red-50 hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExamFormDialog open={formOpen} onOpenChange={setFormOpen} classes={classes} />
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
        description="Les notes déjà saisies pour cet examen seront également supprimées."
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
      />
    </div>
  );
}
