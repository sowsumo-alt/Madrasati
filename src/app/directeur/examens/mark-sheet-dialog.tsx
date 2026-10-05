"use client";

import { useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { defaultTermForDate } from "@/lib/exams";
import type { StudentOrder } from "@/lib/mark-sheet";
import { cn } from "@/lib/utils";
import { TERMS } from "./schema";
import type { ExamClassOption } from "./exam-form-dialog";

const ALL = "ALL";

/**
 * Choix de la feuille de notes à imprimer : classe, matière (ou toutes),
 * trimestre, ordre des élèves, notes déjà saisies ou non. La feuille s'ouvre
 * dans un nouvel onglet, prête à imprimer.
 */
export function MarkSheetDialog({
  open,
  onOpenChange,
  classes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ExamClassOption[];
}) {
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState(ALL);
  const [term, setTerm] = useState<string>(() => defaultTermForDate(new Date()));
  const [order, setOrder] = useState<StudentOrder>("NUMBER");
  const [prefill, setPrefill] = useState(false);

  const classRoom = classes.find((c) => c.id === classId) ?? null;

  function chooseClass(id: string) {
    if (!id) return;
    setClassId(id);
    // Une matière d'une autre classe n'a pas de sens ici.
    if (!classes.find((c) => c.id === id)?.subjects.some((s) => s.id === subjectId)) setSubjectId(ALL);
  }

  function generate() {
    if (!classRoom) return;
    const params = new URLSearchParams({
      classe: classRoom.id,
      matiere: subjectId,
      trimestre: term,
      ordre: order,
      ...(prefill ? { notes: "1" } : {}),
    });
    window.open(`/directeur/examens/feuille-de-notes?${params}`, "_blank");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="mark-sheet-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary-600" />
            Feuille de notes à imprimer
          </DialogTitle>
          <DialogDescription>
            La liste des élèves déjà écrite, des cases vides pour les notes : à remettre à l&apos;enseignant,
            puis à saisir dans Notes dans le même ordre.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mark-sheet-class">Classe</Label>
              <Select value={classId || undefined} onValueChange={chooseClass}>
                <SelectTrigger id="mark-sheet-class">
                  <SelectValue placeholder="Choisir la classe" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mark-sheet-term">Trimestre</Label>
              <Select value={term} onValueChange={(v) => v && setTerm(v)}>
                <SelectTrigger id="mark-sheet-term">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERMS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mark-sheet-subject">Matière</Label>
            <Select value={subjectId} onValueChange={(v) => v && setSubjectId(v)} disabled={!classRoom}>
              <SelectTrigger id="mark-sheet-subject">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>
                  Toutes les matières de la classe{classRoom ? ` (${classRoom.subjects.length} feuilles)` : ""}
                </SelectItem>
                {(classRoom?.subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Ordre des élèves</Label>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Ordre des élèves">
              {(
                [
                  ["NUMBER", "Par N°", "Celui du bulletin et de la saisie des notes"],
                  ["FIRST_NAME", "Par prénom", "Ordre alphabétique des prénoms"],
                ] as const
              ).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={order === value}
                  onClick={() => setOrder(value)}
                  className={cn(
                    "rounded-xl border p-3 text-start transition-colors",
                    order === value
                      ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500"
                      : "border-border bg-surface hover:bg-surface-muted",
                  )}
                  data-testid={`mark-sheet-order-${value}`}
                >
                  <span className="block text-sm font-semibold text-foreground">{label}</span>
                  <span className="block text-xs text-foreground/55">{hint}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={prefill}
              onChange={(e) => setPrefill(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary-700 focus:ring-primary-500"
              data-testid="mark-sheet-prefill"
            />
            <span>
              Pré-remplir les notes déjà saisies
              <span className="block text-xs text-foreground/50">Pour une feuille de contrôle des notes existantes.</span>
            </span>
          </label>

          <p className="text-xs text-foreground/50">
            Les colonnes suivent la règle de calcul de l&apos;école (Paramètres → Règle de calcul → « Cases sur la
            feuille de notes »).
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" onClick={generate} disabled={!classRoom} data-testid="mark-sheet-generate">
            <Printer className="h-4 w-4" />
            Préparer la feuille
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
