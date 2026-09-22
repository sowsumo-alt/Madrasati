"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronRight, Info, Loader2, NotebookPen, Plus, Save, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { onTwenty } from "@/lib/grading";
import { computeSubjectAverage, describeFormula, type MultiRule } from "@/lib/grading-config";
import { cellKey, formatCell, isNewColumn, newColumnKey, parseCell } from "@/lib/grade-sheet";
import type { GradeSheetData } from "@/lib/grade-sheet-data";
import { TERMS } from "@/app/directeur/examens/schema";
import { saveGradeSheet } from "./actions";

interface Column {
  key: string;
  partIndex: number;
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
 * Grille de saisie des notes : une ligne par élève, une colonne par note, et
 * les colonnes regroupées selon la règle de calcul de l'école — « Devoirs »
 * puis « Composition » avec le modèle par défaut. La note retenue par la
 * règle est surlignée et la moyenne de la matière se calcule pendant la
 * saisie.
 */
export function GradeSheetView({
  data,
  examsHref,
  settingsHref,
}: {
  data: GradeSheetData;
  /** Où retrouver la saisie examen par examen. */
  examsHref: string;
  /** Où modifier la règle de calcul ; absent pour un enseignant. */
  settingsHref?: string;
}) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [newColumns, setNewColumns] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const selectedClass = data.classes.find((c) => c.id === data.classId) ?? null;
  const selectedSubject = data.subjects.find((s) => s.id === data.subjectId) ?? null;

  const shortDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ar" ? "ar" : locale === "en" ? "en-GB" : "fr-FR", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
    [locale],
  );

  const ruleLabels = useMemo(
    () =>
      ({
        BEST: t("grading.rule.BEST"),
        AVERAGE: t("grading.rule.AVERAGE"),
        SUM: t("grading.rule.SUM"),
        LAST: t("grading.rule.LAST"),
      }) as Record<MultiRule, string>,
    [t],
  );

  // Les colonnes de chaque bloc : celles déjà enregistrées, puis celles que
  // le directeur vient d'ajouter.
  const columnsByPart: Column[][] = data.parts.map((part, partIndex) => {
    const saved = part.columns.map((c) => ({
      key: c.id,
      partIndex,
      title: c.title,
      subtitle: `/${c.maxScore} · ${shortDate.format(new Date(c.date))}`,
      maxScore: c.maxScore,
      isNew: false,
    }));
    const added = newColumns
      .filter((key) => key.startsWith(`new:${part.id}:`))
      .map((key, i) => ({
        key,
        partIndex,
        title: `${part.label} ${saved.length + i + 1}`,
        subtitle: `/20 · ${t("grades.newColumn")}`,
        maxScore: 20,
        isNew: true,
      }));
    // Un bloc sans aucune note s'ouvre avec une colonne vide : la grille ne
    // s'affiche jamais sans case où saisir.
    if (saved.length === 0 && added.length === 0) {
      return [
        {
          key: newColumnKey(part.id, 0),
          partIndex,
          title: part.label,
          subtitle: `/20 · ${t("grades.toEnter")}`,
          maxScore: 20,
          isNew: true,
        },
      ];
    }
    return [...saved, ...added];
  });
  const columns = columnsByPart.flat();
  // Une colonne calculée par bloc n'a d'intérêt que s'il y a plusieurs blocs
  // ou un poids : sinon elle répéterait la moyenne de la matière.
  const showPartValues = data.parts.length > 1 || data.parts.some((p) => p.weight !== 1);

  const initialValue = (column: string, studentId: string) =>
    formatCell(data.grades[cellKey(column, studentId)]);
  const valueOf = (column: string, studentId: string) =>
    edits[cellKey(column, studentId)] ?? initialValue(column, studentId);

  // La clé d'une case est « colonne:élève » ; une colonne ajoutée contient
  // elle-même des deux-points (« new:devoir:1 »), d'où la coupure à la fin.
  const splitKey = (key: string) => {
    const at = key.lastIndexOf(":");
    return [key.slice(0, at), key.slice(at + 1)] as const;
  };
  const changed = Object.entries(edits).filter(([key, value]) => {
    const [column, studentId] = splitKey(key);
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

  function addColumn(partIndex: number) {
    const part = data.parts[partIndex];
    const used = new Set([...newColumns, ...columnsByPart[partIndex].map((c) => c.key)]);
    let n = 0;
    while (used.has(newColumnKey(part.id, n))) n += 1;
    const opening = columnsByPart[partIndex].filter((c) => c.isNew && !newColumns.includes(c.key));
    setNewColumns((current) => [...current, ...opening.map((c) => c.key), newColumnKey(part.id, n)]);
  }

  function removeColumn(key: string) {
    setNewColumns((current) => current.filter((k) => k !== key));
    setEdits((current) =>
      Object.fromEntries(Object.entries(current).filter(([k]) => !k.startsWith(`${key}:`))),
    );
  }

  function focusCell(row: number, col: number) {
    document.querySelector<HTMLInputElement>(`input[data-row="${row}"][data-col="${col}"]`)?.focus();
  }

  async function handleSave() {
    if (!data.classId || !data.subjectId) return;
    if (invalidCount > 0) {
      toast.error(t("grades.invalid"));
      return;
    }
    setSaving(true);
    try {
      await saveGradeSheet({
        classId: data.classId,
        subjectId: data.subjectId,
        term: data.term,
        newColumns: columns.filter((c) => c.isNew).map((c) => c.key),
        cells: changed.map(([key, value]) => {
          const [column, studentId] = splitKey(key);
          return { column, studentId, value };
        }),
      });
      toast.success(t("grades.saved"));
      // La grille rechargée et la remise à zéro arrivent ensemble : pas
      // d'instant où les notes tapées disparaissent avant d'être relues.
      startTransition(() => {
        setEdits({});
        setNewColumns([]);
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
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <NotebookPen className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("grades.title")}</h1>
            <p className="mt-0.5 text-sm text-foreground/60">{t("grades.subtitle")}</p>
          </div>
          {settingsHref && (
            <Link
              href={settingsHref}
              className="ms-auto inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-primary-800 shadow-sm hover:bg-primary-50/60"
            >
              <Settings2 className="h-4 w-4 text-primary-600" />
              {t("grading.editRule")}
            </Link>
          )}
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
                className="inline-flex items-center rounded-full bg-primary-100/80 px-3 py-1 font-semibold text-primary-800"
                data-testid="grading-level"
              >
                {t(levelKey)}
              </span>
              <span className="text-foreground/60" data-testid="grading-formula">
                {t("grades.subjectAverage")} = {describeFormula(data.formula, ruleLabels)}
              </span>
              {selectedSubject && (
                <span className="ms-auto rounded-full border border-border px-3 py-1 text-foreground/70">
                  {t("grades.coefficient").replace("{n}", String(selectedSubject.coefficient))}
                </span>
              )}
            </div>
          )}

          {data.subjects.length === 0 ? (
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
                      {data.parts.map((part, partIndex) => (
                        <PartHeaderCells
                          key={part.id}
                          columns={columnsByPart[partIndex]}
                          partLabel={part.label}
                          weight={part.weight}
                          showValue={showPartValues}
                          canAdd={data.canAddColumn}
                          removable={newColumns}
                          onAdd={() => addColumn(partIndex)}
                          onRemove={removeColumn}
                          addLabel={t("grades.addNote").replace("{name}", part.label)}
                          removeLabel={t("grades.removeColumn")}
                          valueLabel={
                            part.weight === 1 ? part.label : `${part.label} × ${part.weight}`
                          }
                        />
                      ))}
                      <th className="min-w-[6rem] border-s border-border px-2 py-2 text-center font-semibold">
                        {t("grades.subjectAverage")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s, row) => {
                      const scoresByPart = columnsByPart.map((list) =>
                        list.map((c) => {
                          const p = parseCell(valueOf(c.key, s.id), c.maxScore);
                          return p.invalid || p.score == null ? null : onTwenty(p.score, c.maxScore);
                        }),
                      );
                      const computed = computeSubjectAverage(data.formula, scoresByPart);
                      let col = -1;

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
                          {data.parts.map((part, partIndex) => (
                            <PartCells
                              key={part.id}
                              columns={columnsByPart[partIndex]}
                              showValue={showPartValues}
                              result={computed.parts[partIndex]}
                              cell={(c) => {
                                col += 1;
                                const column = c;
                                const currentCol = col;
                                const value = valueOf(column.key, s.id);
                                const invalid = parseCell(value, column.maxScore).invalid;
                                const used =
                                  computed.parts[partIndex]?.usedIndex ===
                                  columnsByPart[partIndex].indexOf(column);
                                return (
                                  <input
                                    value={value}
                                    onChange={(e) =>
                                      setEdits((current) => ({
                                        ...current,
                                        [cellKey(column.key, s.id)]: e.target.value,
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === "ArrowDown") {
                                        e.preventDefault();
                                        focusCell(row + 1, currentCol);
                                      } else if (e.key === "ArrowUp") {
                                        e.preventDefault();
                                        focusCell(row - 1, currentCol);
                                      }
                                    }}
                                    inputMode="decimal"
                                    dir="ltr"
                                    placeholder="—"
                                    aria-label={`${column.title} — ${s.firstName} ${s.lastName}`}
                                    aria-invalid={invalid || undefined}
                                    data-row={row}
                                    data-col={currentCol}
                                    data-testid={`cell-${column.isNew ? column.key : currentCol}-${row}`}
                                    className={cn(
                                      "h-9 w-full min-w-[4.5rem] rounded-lg border bg-surface px-2 text-center text-sm tabular-nums text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary-500",
                                      invalid
                                        ? "border-red-400 bg-red-50 text-red-700"
                                        : used && columnsByPart[partIndex].length > 1
                                          ? "border-primary-400 bg-primary-50 font-bold text-primary-800"
                                          : "border-border",
                                    )}
                                  />
                                );
                              }}
                            />
                          ))}
                          <td
                            className="border-s border-border px-2 py-1.5 text-center font-bold tabular-nums text-foreground"
                            dir="ltr"
                            data-testid={`average-${row}`}
                          >
                            {computed.average != null
                              ? computed.average.toFixed(2).replace(".", ",")
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="flex gap-2 border-t border-border bg-amber-50/60 px-5 py-3 text-xs leading-relaxed text-amber-900/80">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {t("grades.hint")}{" "}
                <Link href={examsHref} className="font-semibold underline">
                  {t("grades.goToExams")}
                </Link>
              </p>
            </section>
          )}
        </>
      )}

      {changed.length > 0 || saving ? (
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
      ) : null}
    </div>
  );
}

/** En-têtes des colonnes d'un bloc, suivis du bouton « Ajouter ». */
function PartHeaderCells({
  columns,
  showValue,
  canAdd,
  removable,
  onAdd,
  onRemove,
  addLabel,
  removeLabel,
  valueLabel,
}: {
  columns: Column[];
  partLabel: string;
  weight: number;
  showValue: boolean;
  canAdd: boolean;
  removable: string[];
  onAdd: () => void;
  onRemove: (key: string) => void;
  addLabel: string;
  removeLabel: string;
  valueLabel: string;
}) {
  return (
    <>
      {columns.map((c) => (
        <th key={c.key} className="min-w-[6.5rem] px-2 py-2 text-center font-semibold">
          <span className="flex items-center justify-center gap-1">
            <span className="truncate">{c.title}</span>
            {isNewColumn(c.key) && removable.includes(c.key) && (
              <button
                type="button"
                onClick={() => onRemove(c.key)}
                title={removeLabel}
                aria-label={removeLabel}
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
        {canAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-dashed border-primary-300 px-2.5 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100/60"
            data-testid="add-note"
          >
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </button>
        )}
      </th>
      {showValue && (
        <th className="min-w-[5.5rem] border-s border-border px-2 py-2 text-center font-semibold">
          {valueLabel}
        </th>
      )}
    </>
  );
}

/** Cases d'un bloc pour un élève, suivies de la valeur calculée du bloc. */
function PartCells({
  columns,
  showValue,
  result,
  cell,
}: {
  columns: Column[];
  showValue: boolean;
  result: { weighted: number | null } | undefined;
  cell: (column: Column) => React.ReactNode;
}) {
  return (
    <>
      {columns.map((c) => (
        <td key={c.key} className="px-2 py-1.5">
          {cell(c)}
        </td>
      ))}
      <td />
      {showValue && (
        <td
          className="border-s border-border px-2 py-1.5 text-center font-semibold tabular-nums text-primary-700"
          dir="ltr"
          data-testid="part-value"
        >
          {result?.weighted != null ? formatScore(result.weighted) : "—"}
        </td>
      )}
    </>
  );
}
