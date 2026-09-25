"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import {
  assignSubjectToClass,
  copyClassSubjects,
  removeSubjectFromClass,
  setClassSubjectCoefficient,
} from "./actions";
import { Copy, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-provider";

export interface AssignmentSubject {
  id: string;
  name: string;
  /** Coefficient de la matière pour toute l'école. */
  coefficient: number;
}

export interface AssignmentTeacher {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ClassAssignmentsTarget {
  classId: string;
  className: string;
  assignments: { subjectId: string; teacherId: string | null; coefficient: number }[];
}

/**
 * Coefficient de la matière dans cette classe, enregistré en quittant le
 * champ. Au collège et au lycée il suit le bulletin officiel ; le directeur
 * l'ajuste ici si son école compte autrement.
 */
function CoefficientInput({
  value,
  label,
  onSave,
}: {
  value: number;
  label: string;
  onSave: (value: number) => Promise<void>;
}) {
  const [text, setText] = useState(String(value));
  const [saved, setSaved] = useState(value);
  if (saved !== value) {
    setSaved(value);
    setText(String(value));
  }

  async function commit() {
    const parsed = Number(text);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
      setText(String(value));
      return;
    }
    if (parsed !== value) await onSave(parsed);
  }

  return (
    <input
      type="number"
      min={1}
      max={20}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      aria-label={label}
      title={label}
      className="h-9 w-14 rounded-lg border border-border bg-surface px-2 text-center text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500"
    />
  );
}

/**
 * Reprendre les matières et coefficients d'une autre classe — une deuxième
 * section du même niveau, typiquement. Chaque niveau garde ainsi sa propre
 * liste, sans ressaisie.
 */
function CopyFromClass({
  targetClassId,
  classes,
}: {
  targetClassId: string;
  classes: { id: string; name: string }[];
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [sourceId, setSourceId] = useState("");
  const [loading, setLoading] = useState(false);
  const options = classes.filter((c) => c.id !== targetClassId);
  if (options.length === 0) return null;

  async function handleCopy() {
    if (!sourceId) return;
    const source = options.find((c) => c.id === sourceId)?.name ?? "";
    if (!window.confirm(t("classes.copyConfirm").replace("{name}", source))) return;
    setLoading(true);
    try {
      const { kept } = await copyClassSubjects(targetClassId, sourceId);
      toast.success(
        kept > 0
          ? t("classes.copiedKept").replace("{n}", String(kept))
          : t("classes.copied").replace("{name}", source),
      );
      setSourceId("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg bg-primary-50/60 px-3 py-2.5"
      data-testid="copy-from-class"
    >
      <span className="text-sm text-foreground/70">{t("classes.copyFrom")}</span>
      <Select value={sourceId || undefined} onValueChange={setSourceId}>
        <SelectTrigger className="h-9 w-40" aria-label={t("classes.copyFrom")}>
          <SelectValue placeholder={t("classes.copyPick")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="secondary" onClick={handleCopy} disabled={!sourceId || loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
        {t("classes.copyApply")}
      </Button>
    </div>
  );
}

interface ClassAssignmentsDialogProps {
  target: ClassAssignmentsTarget | null;
  onOpenChange: (open: boolean) => void;
  subjects: AssignmentSubject[];
  teachers: AssignmentTeacher[];
  /** Les classes de l'année, pour en reprendre la configuration. */
  classes?: { id: string; name: string }[];
}

export function ClassAssignmentsDialog({
  target,
  onOpenChange,
  subjects,
  teachers,
  classes = [],
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

  async function handleCoefficientChange(subjectId: string, coefficient: number) {
    if (!target) return;
    try {
      await setClassSubjectCoefficient(target.classId, subjectId, coefficient);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  }

  const totalCoefficients = (target?.assignments ?? [])
    .filter((a) => subjects.some((s) => s.id === a.subjectId))
    .reduce((sum, a) => sum + a.coefficient, 0);

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

        {target && <CopyFromClass targetClassId={target.classId} classes={classes} />}

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
                {checked && assignment && (
                  <CoefficientInput
                    value={assignment.coefficient}
                    label={`${t("classes.coefficient")} — ${s.name}`}
                    onSave={(value) => handleCoefficientChange(s.id, value)}
                  />
                )}
                {checked && (
                  <Select
                    value={assignment?.teacherId ?? "none"}
                    onValueChange={(v) => handleTeacherChange(s.id, v)}
                  >
                    <SelectTrigger className="w-36 sm:w-44">
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

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-sm text-foreground/70" data-testid="class-total-coefficients">
            {t("classes.totalCoefficients")} : <strong className="tabular-nums">{totalCoefficients}</strong>
          </p>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
