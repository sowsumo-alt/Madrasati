"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight, Info, Loader2, NotebookPen, Plus, Save, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { onTwenty, secondarySubjectAverage } from "@/lib/grading";
import {
  cellKey,
  formatCell,
  NEW_COMPOSITION,
  NEW_DEVOIR_PREFIX,
  parseCell,
} from "@/lib/grade-sheet";
import type { GradeSheetData } from "@/lib/grade-sheet-data";
import { TERMS } from "@/app/directeur/examens/schema";
import { saveGradeSheet } from "./actions";

interface Column {
  key: string;
  title: string;
  subtitle: string;
  maxScore: number;
  isNew: boolean;
}

/** 13,75 : virgule française, deux décimales au plus. */
function formatScore(value: number): string {
  return String(Math.round(value * 100) / 100).replace(".", ",");
}

/**
 * Grille de saisie du collège et du lycée : une ligne par élève, une colonne
 * par devoir — autant qu'il en faut, avec « Ajouter un devoir » — et une
 * colonne pour la composition. Le meilleur devoir de chaque élève est
 * surligné et la moyenne de la matière se calcule pendant la saisie.
 */
export function GradeSheetView({
  data,
  examsHref,
}: {
  data: GradeSheetData;
  /** Où saisir les notes d'une classe du Fondamental. */
  examsHref: string;
}) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [newDevoirs, setNewDevoirs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const selectedClass = data.classes.find((c) => c.id === data.classId) ?? null;
  const selectedSubject = data.subjects.find((s) => s.id === data.subjectId) ?? null;
  const isSecondary = selectedClass?.scheme === "SECONDARY";

  const shortDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ar" ? "ar" : locale === "en" ? "en-GB" : "fr-FR", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
    [locale],
  );

  const devoirColumns: Column[] = [
    ...data.devoirs.map((d) => ({
      key: d.id,
      title: d.title,
      subtitle: `/${d.maxScore} · ${shortDate.format(new Date(d.date))}`,
      maxScore: d.maxScore,
      isNew: false,
    })),
    ...newDevoirs.map((key, i) => ({
      key,
      title: t("grades.devoirN").replace("{n}", String(data.devoirs.length + i + 1)),
      subtitle: `/20 · ${t("grades.newColumn")}`,
      maxScore: 20,
      isNew: true,
    })),
  ];
  // Sans aucun devoir, une première colonne est proposée d'emblée : la grille
  // ne s'ouvre jamais sans case où saisir.
  if (devoirColumns.length === 0) {
    devoirColumns.push({
      key: `${NEW_DEVOIR_PREFIX}0`,
      title: t("grades.devoirN").replace("{n}", "1"),
      subtitle: `/20 · ${t("grades.newColumn")}`,
      maxScore: 20,
      isNew: true,
    });
  }
  const compositionColumn: Column = data.composition
    ? {
        key: data.composition.id,
        title: t("exams.kind.COMPOSITION"),
        subtitle: `/${data.composition.maxScore} · ${shortDate.format(new Date(data.composition.date))}`,
        maxScore: data.composition.maxScore,
        isNew: false,
      }
    : {
        key: NEW_COMPOSITION,
        title: t("exams.kind.COMPOSITION"),
        subtitle: `/20 · ${t("grades.toEnter")}`,
        maxScore: 20,
        isNew: true,
      };
  const columns = [...devoirColumns, compositionColumn];

  const initialValue = (column: string, studentId: string) =>
    formatCell(data.grades[cellKey(column, studentId)]);
  const valueOf = (column: string, studentId: string) =>
    edits[cellKey(column, studentId)] ?? initialValue(column, studentId);

  const changed = Object.entries(edits).filter(([key, value]) => {
    const [column, studentId] = key.split(":");
    return value.trim() !== initialValue(column, studentId);
  });
  const invalidCount = data.students.reduce(
    (count, s) =>
      count + columns.filter((c) => parseCell(valueOf(c.key, s.id), c.maxScore).invalid).length,
    0,
  );

  function navigate(next: { classe?: string; matiere?: string; trimestre?: string }) {
    if (changed.length > 0 && !window.confirm(t("grades.leaveUnsaved"))) return;
    const params = new URLSearchParams();
    const classe = next.classe ?? data.classId;
    if (classe) params.set("classe", classe);
    // Une autre classe n'a pas forcément la même matière : on laisse la page
    // choisir la première des siennes.
    const matiere = next.classe ? next.matiere : (next.matiere ?? data.subjectId);
    if (matiere) params.set("matiere", matiere);
    params.set("trimestre", next.trimestre ?? data.term);
    router.push(`${pathname}?${params.toString()}`);
  }

  function addDevoir() {
    const used = new Set([...newDevoirs, ...devoirColumns.map((c) => c.key)]);
    let n = newDevoirs.length + 1;
    while (used.has(`${NEW_DEVOIR_PREFIX}${n}`)) n += 1;
    // La colonne proposée d'office (sans aucun devoir) devient la première.
    const base = data.devoirs.length === 0 && newDevoirs.length === 0 ? [`${NEW_DEVOIR_PREFIX}0`] : [];
    setNewDevoirs((current) => [...(current.length === 0 ? base : current), `${NEW_DEVOIR_PREFIX}${n}`]);
  }

  function removeNewDevoir(key: string) {
    setNewDevoirs((current) => current.filter((k) => k !== key));
    setEdits((current) =>
      Object.fromEntries(Object.entries(current).filter(([k]) => !k.startsWith(`${key}:`))),
    );
  }

  function focusCell(row: number, col: number) {
    document
      .querySelector<HTMLInputElement>(`input[data-row="${row}"][data-col="${col}"]`)
      ?.focus();
  }

  async function handleSave() {
    if (!data.classId || !data.subjectId) return;
    if (invalidCount > 0) {
      toast.error(t("grades.invalid"));
      return;
    }
    const devoirKeys = devoirColumns.filter((c) => c.isNew).map((c) => c.key);
    setSaving(true);
    try {
      await saveGradeSheet({
        classId: data.classId,
        subjectId: data.subjectId,
        term: data.term,
        newDevoirs: devoirKeys,
        cells: changed.map(([key, value]) => {
          const [column, studentId] = key.split(":");
          return { column, studentId, value };
        }),
      });
      toast.success(t("grades.saved"));
      // La grille rechargée et la remise à zéro arrivent ensemble : pas
      // d'instant où les notes tapées disparaissent avant d'être relues.
      startTransition(() => {
        setEdits({});
        setNewDevoirs([]);
        router.refresh();
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  const levelKey = selectedClass
    ? (`grades.level.${selectedClass.level ?? "UNKNOWN"}` as TranslationKey)
    : null;

  return (
    <div className="space-y-5 pb-24">
      <div>
        <nav
          aria-label={t("nav.category.pedagogy")}
          className="mb-1.5 flex items-center gap-1.5 text-xs text-foreground/50"
        >
          <span>{t("nav.category.pedagogy")}</span>
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          <span className="font-medium text-foreground/70">{t("nav.grades")}</span>
        </nav>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <NotebookPen className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("grades.title")}</h1>
            <p className="mt-0.5 text-sm text-foreground/60">{t("grades.subtitle")}</p>
          </div>
        </div>
      </div>

      {data.classes.length === 0 ? (
        <div className="rounded-2xl border border-border/80 bg-surface px-5 py-16 text-center text-sm text-foreground/50 shadow-soft">
          {t("grades.noClasses")}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 rounded-2xl border border-border/80 bg-surface p-3 shadow-soft sm:grid-cols-3">
            <Select value={data.classId ?? ""} onValueChange={(v) => navigate({ classe: v })}>
              <SelectTrigger aria-label={t("students.class")}>
                <SelectValue>{selectedClass?.name ?? t("students.class")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {data.classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={data.subjectId ?? ""}
              onValueChange={(v) => navigate({ matiere: v })}
              disabled={data.subjects.length === 0}
            >
              <SelectTrigger aria-label={t("grades.subject")}>
                <SelectValue>{selectedSubject?.name ?? t("grades.subject")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {data.subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={data.term} onValueChange={(v) => navigate({ trimestre: v })}>
              <SelectTrigger aria-label={t("exams.term")}>
                <SelectValue>{data.term}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TERMS.map((term) => (
                  <SelectItem key={term} value={term}>
                    {term}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedClass && levelKey && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 font-semibold",
                  isSecondary ? "bg-primary-100/80 text-primary-800" : "bg-amber-100 text-amber-800",
                )}
                data-testid="grading-level"
              >
                {t(levelKey)}
              </span>
              {isSecondary && (
                <span className="text-foreground/60" data-testid="grading-formula">
                  {t("grades.formula")}
                </span>
              )}
              {isSecondary && selectedSubject && (
                <span className="ms-auto rounded-full border border-border px-3 py-1 text-foreground/70">
                  {t("grades.coefficient").replace("{n}", String(selectedSubject.coefficient))}
                </span>
              )}
            </div>
          )}

          {!isSecondary ? (
            <section
              className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 sm:p-6"
              data-testid="standard-class"
            >
              <div className="flex gap-3">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <h2 className="font-semibold text-amber-900">{t("grades.standardTitle")}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
                    {t("grades.standardBody")}
                  </p>
                  <Link href={examsHref} className={cn(buttonVariants({ variant: "secondary" }), "mt-4")}>
                    {t("grades.goToExams")}
                  </Link>
                </div>
              </div>
            </section>
          ) : data.subjects.length === 0 ? (
            <div className="rounded-2xl border border-border/80 bg-surface px-5 py-16 text-center text-sm text-foreground/50 shadow-soft">
              {t("grades.noSubjects")}
            </div>
          ) : data.students.length === 0 ? (
            <div className="rounded-2xl border border-border/80 bg-surface px-5 py-16 text-center text-sm text-foreground/50 shadow-soft">
              {t("grades.noStudents")}
            </div>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse text-sm" data-testid="grade-sheet">
                  <thead>
                    <tr className="border-b border-border bg-primary-50/60 text-xs text-primary-800">
                      <th className="sticky start-0 z-10 w-10 bg-primary-50 px-3 py-3 text-start font-semibold">
                        {t("grades.number")}
                      </th>
                      <th className="sticky start-10 z-10 min-w-[11rem] bg-primary-50 px-3 py-3 text-start font-semibold">
                        {t("grades.student")}
                      </th>
                      {devoirColumns.map((c) => (
                        <th key={c.key} className="min-w-[6.5rem] px-2 py-2 text-center font-semibold">
                          <span className="flex items-center justify-center gap-1">
                            <span className="truncate">{c.title}</span>
                            {c.isNew && newDevoirs.includes(c.key) && (
                              <button
                                type="button"
                                onClick={() => removeNewDevoir(c.key)}
                                title={t("grades.removeColumn")}
                                aria-label={t("grades.removeColumn")}
                                className="rounded p-0.5 text-primary-700/60 hover:bg-primary-100 hover:text-primary-900"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </span>
                          <span className="block text-[11px] font-normal text-foreground/50">{c.subtitle}</span>
                        </th>
                      ))}
                      <th className="px-2 py-2 text-center">
                        {data.canAddDevoir && (
                          <button
                            type="button"
                            onClick={addDevoir}
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-dashed border-primary-300 px-2.5 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100/60"
                            data-testid="add-devoir"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {t("grades.addDevoir")}
                          </button>
                        )}
                      </th>
                      <th className="min-w-[7rem] border-s border-border px-2 py-2 text-center font-semibold">
                        {compositionColumn.title}
                        <span className="block text-[11px] font-normal text-foreground/50">
                          {compositionColumn.subtitle}
                        </span>
                      </th>
                      <th className="min-w-[6rem] border-s border-border px-2 py-2 text-center font-semibold">
                        {t("grades.bestTimes3")}
                      </th>
                      <th className="min-w-[6rem] px-2 py-2 text-center font-semibold">
                        {t("grades.subjectAverage")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s, row) => {
                      const devoirScores = devoirColumns.map((c) => {
                        const p = parseCell(valueOf(c.key, s.id), c.maxScore);
                        return p.invalid || p.score == null ? null : onTwenty(p.score, c.maxScore);
                      });
                      const cp = parseCell(valueOf(compositionColumn.key, s.id), compositionColumn.maxScore);
                      const composition =
                        cp.invalid || cp.score == null ? null : onTwenty(cp.score, compositionColumn.maxScore);
                      const calc = secondarySubjectAverage(devoirScores, composition);

                      const cell = (c: Column, col: number, best: boolean) => {
                        const value = valueOf(c.key, s.id);
                        const invalid = parseCell(value, c.maxScore).invalid;
                        return (
                          <input
                            value={value}
                            onChange={(e) =>
                              setEdits((current) => ({ ...current, [cellKey(c.key, s.id)]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "ArrowDown") {
                                e.preventDefault();
                                focusCell(row + 1, col);
                              } else if (e.key === "ArrowUp") {
                                e.preventDefault();
                                focusCell(row - 1, col);
                              }
                            }}
                            inputMode="decimal"
                            dir="ltr"
                            placeholder="—"
                            aria-label={`${c.title} — ${s.firstName} ${s.lastName}`}
                            aria-invalid={invalid || undefined}
                            data-row={row}
                            data-col={col}
                            data-testid={`cell-${c.isNew ? c.key : col}-${row}`}
                            className={cn(
                              "h-9 w-full min-w-[4.5rem] rounded-lg border bg-surface px-2 text-center text-sm tabular-nums text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary-500",
                              invalid
                                ? "border-red-400 bg-red-50 text-red-700"
                                : best
                                  ? "border-primary-400 bg-primary-50 font-bold text-primary-800"
                                  : "border-border",
                            )}
                          />
                        );
                      };

                      return (
                        <tr key={s.id} className="border-b border-border/70 last:border-b-0">
                          <td className="sticky start-0 z-[1] bg-surface px-3 py-1.5 text-foreground/50 tabular-nums">
                            {String(row + 1).padStart(2, "0")}
                          </td>
                          <td className="sticky start-10 z-[1] bg-surface px-3 py-1.5 font-medium text-foreground">
                            <span className="line-clamp-1">
                              {s.firstName} {s.lastName}
                            </span>
                          </td>
                          {devoirColumns.map((c, col) => (
                            <td key={c.key} className="px-2 py-1.5">
                              {cell(c, col, calc.bestIndex === col)}
                            </td>
                          ))}
                          <td />
                          <td className="border-s border-border px-2 py-1.5">
                            {cell(compositionColumn, devoirColumns.length, false)}
                          </td>
                          <td
                            className="border-s border-border px-2 py-1.5 text-center font-semibold tabular-nums text-primary-700"
                            dir="ltr"
                            data-testid={`times3-${row}`}
                          >
                            {calc.bestTimes3 != null ? formatScore(calc.bestTimes3) : "—"}
                          </td>
                          <td
                            className="px-2 py-1.5 text-center font-bold tabular-nums text-foreground"
                            dir="ltr"
                            data-testid={`average-${row}`}
                          >
                            {calc.average != null ? calc.average.toFixed(2).replace(".", ",") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="flex gap-2 border-t border-border bg-amber-50/60 px-5 py-3 text-xs leading-relaxed text-amber-900/80">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t("grades.hint")}
              </p>
            </section>
          )}
        </>
      )}

      {isSecondary && (changed.length > 0 || saving) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur lg:start-64">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <p className="text-sm text-foreground/70" data-testid="unsaved-count">
              {invalidCount > 0
                ? t("grades.invalid")
                : t("grades.unsaved").replace("{n}", String(changed.length))}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEdits({})} disabled={saving}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSave} disabled={saving || invalidCount > 0} data-testid="save-grades">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
