"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveGrades } from "./actions";

export interface GradesDialogStudent {
  id: string;
  firstName: string;
  lastName: string;
  score: number | null;
  isAbsent: boolean;
}

export interface GradesDialogTarget {
  examId: string;
  title: string;
  className: string;
  subjectName: string;
  maxScore: number;
  students: GradesDialogStudent[];
}

export function GradesDialog({
  target,
  onOpenChange,
}: {
  target: GradesDialogTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<Record<string, { score: string; isAbsent: boolean }>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    const next: Record<string, { score: string; isAbsent: boolean }> = {};
    for (const s of target.students) {
      next[s.id] = {
        score: s.score != null ? String(s.score) : "",
        isAbsent: s.isAbsent,
      };
    }
    setEntries(next);
  }, [target]);

  const scored = Object.values(entries)
    .filter((e) => !e.isAbsent && e.score !== "")
    .map((e) => Number(e.score))
    .filter((n) => !Number.isNaN(n));
  const average =
    scored.length > 0
      ? (scored.reduce((sum, n) => sum + n, 0) / scored.length).toFixed(2)
      : null;

  async function handleSave() {
    if (!target) return;
    setIsSaving(true);
    try {
      await saveGrades(
        target.examId,
        Object.entries(entries).map(([studentId, e]) => ({
          studentId,
          score: e.score,
          isAbsent: e.isAbsent,
        })),
      );
      toast.success("Notes enregistrées.");
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saisir les notes</DialogTitle>
          {target && (
            <DialogDescription>
              {target.title} — {target.className} · {target.subjectName} · sur{" "}
              {target.maxScore}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="max-h-80 space-y-1 overflow-y-auto">
          {target?.students.map((s) => {
            const entry = entries[s.id] ?? { score: "", isAbsent: false };
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <span className="flex-1 text-sm text-foreground">
                  {s.firstName} {s.lastName}
                </span>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground/60">
                  <input
                    type="checkbox"
                    checked={entry.isAbsent}
                    onChange={(e) =>
                      setEntries((m) => ({
                        ...m,
                        [s.id]: { score: "", isAbsent: e.target.checked },
                      }))
                    }
                    className="h-4 w-4 rounded border-border text-primary-700 focus:ring-primary-500"
                  />
                  Absent
                </label>
                <Input
                  type="number"
                  min={0}
                  max={target.maxScore}
                  step="0.25"
                  value={entry.score}
                  disabled={entry.isAbsent}
                  onChange={(e) =>
                    setEntries((m) => ({
                      ...m,
                      [s.id]: { score: e.target.value, isAbsent: false },
                    }))
                  }
                  className="w-24"
                />
              </div>
            );
          })}
        </div>

        {average && (
          <p className="text-sm text-foreground/70">
            Moyenne de la classe :{" "}
            <span className="font-semibold text-primary-800">
              {average} / {target?.maxScore}
            </span>
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
