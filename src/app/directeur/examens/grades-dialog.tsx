"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MessageCircle } from "lucide-react";
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
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import { rankOf } from "@/lib/report-card";
import { withArabic, schoolSignatureFr, schoolSignatureAr } from "@/lib/whatsapp";
import { saveGrades } from "./actions";

export interface GradesDialogStudent {
  id: string;
  firstName: string;
  lastName: string;
  score: number | null;
  isAbsent: boolean;
  parentName?: string | null;
  parentPhone?: string | null;
}

export interface GradesDialogTarget {
  examId: string;
  title: string;
  className: string;
  subjectName: string;
  maxScore: number;
  students: GradesDialogStudent[];
}

/** Message bilingue (français puis arabe, si le plan de l'école l'inclut) envoyé au parent sur WhatsApp. */
function buildGradeMessage(params: {
  parentName: string;
  studentName: string;
  score: number;
  maxScore: number;
  subjectName: string;
  examTitle: string;
  schoolName: string;
  rank: number | null;
  total: number;
  bilingual: boolean;
}) {
  const { parentName, studentName, score, maxScore, subjectName, examTitle, schoolName, rank, total, bilingual } =
    params;
  const rankFr = rank != null ? ` Rang : ${rank} sur ${total}.` : "";
  const rankAr = rank != null ? ` الترتيب: ${rank} من ${total}.` : "";

  const fr =
    `Bonjour ${parentName},\n\n` +
    `${studentName} a obtenu ${score}/${maxScore} en ${subjectName} (${examTitle}).${rankFr}\n\n` +
    schoolSignatureFr(schoolName);
  if (!bilingual) return fr;

  const ar =
    `مرحبًا ${parentName}،\n\n` +
    `حصل ${studentName} على ${score}/${maxScore} في مادة ${subjectName} (${examTitle}).${rankAr}\n\n` +
    schoolSignatureAr(schoolName);

  return withArabic(fr, ar);
}

export function GradesDialog({
  target,
  schoolName,
  bilingual,
  onOpenChange,
}: {
  target: GradesDialogTarget | null;
  schoolName: string;
  bilingual: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<Record<string, { score: string; isAbsent: boolean }>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    setSaved(false);
  }, [target]);

  const scored = Object.values(entries)
    .filter((e) => !e.isAbsent && e.score !== "")
    .map((e) => Number(e.score))
    .filter((n) => !Number.isNaN(n));
  const average =
    scored.length > 0
      ? (scored.reduce((sum, n) => sum + n, 0) / scored.length).toFixed(2)
      : null;

  function rankFor(studentId: string) {
    const entry = entries[studentId];
    if (!entry || entry.isAbsent || entry.score === "") return null;
    const score = Number(entry.score);
    if (Number.isNaN(score)) return null;
    return rankOf(score, scored);
  }

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
      setSaved(true);
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
            const rank = rankFor(s.id);
            const canNotify =
              saved && !entry.isAbsent && entry.score !== "" && Boolean(s.parentPhone);
            const gradeMessage = canNotify
              ? buildGradeMessage({
                  parentName: s.parentName ?? "",
                  studentName: `${s.firstName} ${s.lastName}`,
                  score: Number(entry.score),
                  maxScore: target!.maxScore,
                  subjectName: target!.subjectName,
                  examTitle: target!.title,
                  schoolName,
                  rank,
                  total: scored.length,
                  bilingual,
                })
              : null;

            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <span className="flex-1 text-sm text-foreground">
                  {s.firstName} {s.lastName}
                  {rank != null && (
                    <span className="ml-2 text-xs font-medium text-primary-600">
                      #{rank}
                    </span>
                  )}
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
                  max={target?.maxScore}
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
                {canNotify ? (
                  <WhatsAppLink
                    phone={s.parentPhone as string}
                    message={gradeMessage as string}
                    title="Alerter le parent sur WhatsApp"
                    className="shrink-0"
                  />
                ) : (
                  <span className="w-8 shrink-0" />
                )}
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
        {saved && (
          <p className="text-xs text-foreground/50">
            Notes enregistrées — cliquez sur{" "}
            <MessageCircle className="inline h-3.5 w-3.5 text-primary-600" /> pour prévenir un
            parent sur WhatsApp.
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {saved ? "Fermer" : "Annuler"}
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
