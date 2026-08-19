"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignSubjectToClass, removeSubjectFromClass } from "./actions";
import { useLanguage } from "@/lib/i18n/language-provider";

export interface AssignmentSubject {
  id: string;
  name: string;
}

export interface AssignmentTeacher {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ClassAssignmentsTarget {
  classId: string;
  className: string;
  assignments: { subjectId: string; teacherId: string | null }[];
}

interface ClassAssignmentsDialogProps {
  target: ClassAssignmentsTarget | null;
  onOpenChange: (open: boolean) => void;
  subjects: AssignmentSubject[];
  teachers: AssignmentTeacher[];
}

export function ClassAssignmentsDialog({
  target,
  onOpenChange,
  subjects,
  teachers,
}: ClassAssignmentsDialogProps) {
  const { t } = useLanguage();
  const router = useRouter();

  async function handleToggle(subjectId: string, checked: boolean) {
    if (!target) return;
    try {
      if (checked) {
        await assignSubjectToClass(target.classId, subjectId, null);
      } else {
        await removeSubjectFromClass(target.classId, subjectId);
      }
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    }
  }

  async function handleTeacherChange(subjectId: string, teacherId: string) {
    if (!target) return;
    try {
      await assignSubjectToClass(target.classId, subjectId, teacherId === "none" ? null : teacherId);
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    }
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Matières de {target?.className}</DialogTitle>
          <DialogDescription>{t("classes.assignHint")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-96 space-y-1 overflow-y-auto">
          {subjects.map((s) => {
            const assignment = target?.assignments.find((a) => a.subjectId === s.id);
            const checked = Boolean(assignment);
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <label className="flex flex-1 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => handleToggle(s.id, e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary-700 focus:ring-primary-500"
                  />
                  <span className="text-sm text-foreground">{s.name}</span>
                </label>
                {checked && (
                  <Select
                    value={assignment?.teacherId ?? "none"}
                    onValueChange={(v) => handleTeacherChange(s.id, v)}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Enseignant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("classes.unassigned")}</SelectItem>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.firstName} {t.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
