"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateIn } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { ImportCell } from "@/lib/student-import";
import {
  fillMerges,
  formatTime,
  matchSubject,
  normalizeText,
  parseScheduleRows,
  suggestClassId,
  type ImportSubject,
} from "@/lib/schedule-import";
import { importSchedule } from "./import-actions";

export interface ImportClassOption {
  id: string;
  name: string;
  /** Matières déjà données à la classe. */
  subjectIds: string[];
  /** Cours déjà programmés. */
  slotCount: number;
}

interface Source {
  label: string;
  rows: ImportCell[][];
}

const SKIP = "__skip";
const keyOf = (label: string) => normalizeText(label);
const firstTexts = (rows: ImportCell[][]) =>
  rows
    .slice(0, 3)
    .flat()
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .join(" ");

/**
 * Import d'un emploi du temps : le fichier de l'école tel quel (Excel ou
 * Word), lu par lib/schedule-import.ts. Le directeur voit chaque cours, corrige
 * une matière mal reconnue, choisit la classe, puis confirme.
 */
export function ScheduleImportDialog({
  open,
  onOpenChange,
  classes,
  subjects,
  defaultClassId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Classes de l'année en cours. */
  classes: ImportClassOption[];
  /** Matières de l'école. */
  subjects: ImportSubject[];
  defaultClassId: string | null;
}) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [classId, setClassId] = useState(defaultClassId ?? "");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [replace, setReplace] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: { course: string; reason: string }[]; addedSubjects: string[] } | null>(null);

  const source = sources[sourceIndex] ?? null;
  const parsed = useMemo(() => (source ? parseScheduleRows(source.rows) : null), [source]);
  const targetClass = classes.find((c) => c.id === classId) ?? null;
  const sortedSubjects = useMemo(() => [...subjects].sort((a, b) => a.name.localeCompare(b.name, "fr")), [subjects]);

  // Les matières écrites dans le fichier, chacune une fois.
  const labels = useMemo(() => {
    const seen = new Map<string, { text: string; count: number }>();
    for (const slot of parsed?.slots ?? []) {
      const key = keyOf(slot.label);
      const entry = seen.get(key);
      if (entry) entry.count++;
      else seen.set(key, { text: slot.label, count: 1 });
    }
    return [...seen.entries()].map(([key, v]) => ({ key, ...v }));
  }, [parsed]);

  const subjectFor = (label: string) => {
    const chosen = mapping[keyOf(label)];
    return chosen === undefined ? (matchSubject(label, subjects) ?? SKIP) : chosen;
  };
  const kept = (parsed?.slots ?? []).filter((s) => subjectFor(s.label) !== SKIP);
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  // 1er janvier 2024 : un lundi. Noms des jours dans la langue de l'interface.
  const dayLabel = (day: number) => formatDateIn(locale, new Date(Date.UTC(2024, 0, day)), { weekday: "long" });

  function reset() {
    setFileName(null);
    setSources([]);
    setSourceIndex(0);
    setMapping({});
    setResult(null);
    setReplace(true);
    setClassId(defaultClassId ?? "");
    if (inputRef.current) inputRef.current.value = "";
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  function chooseSource(list: Source[], index: number, name: string) {
    setSourceIndex(index);
    setMapping({});
    const suggested = suggestClassId([list[index]?.label, firstTexts(list[index]?.rows ?? []), name], classes);
    if (suggested) setClassId(suggested);
  }

  async function handleFile(f: File) {
    if (/\.doc$/i.test(f.name)) {
      toast.error(t("scheduleImport.oldWord"));
      return;
    }
    setReading(true);
    try {
      let list: Source[];
      if (/\.docx$/i.test(f.name)) {
        const [{ readWordTables }, buffer] = await Promise.all([import("@/lib/word-import"), f.arrayBuffer()]);
        list = readWordTables(new Uint8Array(buffer), { fillMerged: true }).map((table) => ({ label: table.label, rows: table.rows }));
      } else {
        const [XLSX, buffer] = await Promise.all([import("xlsx"), f.arrayBuffer()]);
        const workbook = XLSX.read(buffer, { type: "array" });
        list = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          // Le texte affiché (« 08:00 », « 8h-9h ») plutôt que la valeur brute d'une heure Excel.
          const rows = XLSX.utils.sheet_to_json<ImportCell[]>(sheet, { header: 1, defval: "", raw: false, blankrows: true });
          const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : { s: { r: 0, c: 0 } };
          return { label: name, rows: fillMerges(rows, sheet["!merges"] ?? [], range.s) };
        });
      }
      // La feuille (ou le tableau) qui donne le plus de cours d'abord.
      const best = list.reduce(
        (top, s, i) => {
          const count = parseScheduleRows(s.rows).slots.length;
          return count > top.count ? { index: i, count } : top;
        },
        { index: 0, count: -1 },
      );
      setFileName(f.name);
      setSources(list);
      setResult(null);
      chooseSource(list, best.index, f.name);
    } catch {
      toast.error(t("scheduleImport.readError"));
    } finally {
      setReading(false);
    }
  }

  async function submit() {
    if (!targetClass || kept.length === 0) return;
    setImporting(true);
    try {
      const res = await importSchedule({
        classId: targetClass.id,
        replace: targetClass.slotCount > 0 && replace,
        slots: kept.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startMinutes: s.startMinutes,
          endMinutes: s.endMinutes,
          subjectId: subjectFor(s.label),
          room: s.room,
        })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("scheduleImport.done").replace("{n}", String(res.created)));
      router.refresh();
      if (res.skipped.length > 0 || res.addedSubjects.length > 0) {
        setResult({ created: res.created, skipped: res.skipped, addedSubjects: res.addedSubjects });
      } else {
        close();
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto" data-testid="schedule-import-dialog">
        <DialogHeader>
          <DialogTitle>{t("scheduleImport.title")}</DialogTitle>
          <DialogDescription>{t("scheduleImport.description")}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4" data-testid="schedule-import-result">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {t("scheduleImport.done").replace("{n}", String(result.created))}
            </p>
            {result.addedSubjects.length > 0 && (
              <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground/80">
                {t("scheduleImport.addedSubjects").replace("{list}", result.addedSubjects.join(", "))}
              </p>
            )}
            {result.skipped.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                <p className="font-medium">{t("scheduleImport.skippedTitle").replace("{n}", String(result.skipped.length))}</p>
                <ul className="mt-1.5 list-disc space-y-0.5 ps-5 text-xs" data-testid="schedule-import-skipped">
                  {result.skipped.map((s) => (
                    <li key={s.course}>
                      {s.course} — {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <DialogFooter>
              <Button onClick={close}>
                {t("common.close")}
              </Button>
            </DialogFooter>
          </div>
        ) : !source ? (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={reading}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-muted px-6 py-10 text-center transition-colors hover:border-primary-400 disabled:opacity-60"
            >
              {reading ? <Loader2 className="h-8 w-8 animate-spin text-primary-600" /> : <UploadCloud className="h-8 w-8 text-foreground/40" />}
              <span className="text-sm font-medium text-foreground">
                {reading ? t("scheduleImport.reading") : t("scheduleImport.pickFile")}
              </span>
              <span className="text-xs text-foreground/50">{t("scheduleImport.formats")}</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.ods,.docx,.doc"
              className="hidden"
              data-testid="schedule-import-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-3">
              {sources.length > 1 && (
                <label className="min-w-48 flex-1 space-y-1">
                  <span className="text-xs font-medium text-foreground/60">{t("scheduleImport.source")}</span>
                  <Select value={String(sourceIndex)} onValueChange={(v) => chooseSource(sources, Number(v), fileName ?? "")}>
                    <SelectTrigger data-testid="schedule-import-source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sources.map((s, i) => (
                        <SelectItem key={`${s.label}-${i}`} value={String(i)}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              )}
              <label className="min-w-48 flex-1 space-y-1">
                <span className="text-xs font-medium text-foreground/60">{t("scheduleImport.class")}</span>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger data-testid="schedule-import-class">
                    <SelectValue placeholder={t("scheduleImport.chooseClass")} />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <Button variant="secondary" onClick={reset}>
                {t("scheduleImport.otherFile")}
              </Button>
            </div>

            {!parsed || parsed.slots.length === 0 ? (
              <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900" data-testid="schedule-import-empty">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {t("scheduleImport.nothingFound")}
              </p>
            ) : (
              <>
                <p className="text-sm text-foreground/70" data-testid="schedule-import-found">
                  {fileName} — {t("scheduleImport.found").replace("{n}", String(parsed.slots.length))}
                </p>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">{t("scheduleImport.subjects")}</h3>
                  <p className="text-xs text-foreground/55">{t("scheduleImport.subjectsHint")}</p>
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {labels.map((l) => {
                      const value = subjectFor(l.text);
                      const unknown = value === SKIP && mapping[l.key] === undefined;
                      const notInClass = value !== SKIP && targetClass != null && !targetClass.subjectIds.includes(value);
                      return (
                        <div
                          key={l.key}
                          className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2", unknown && "bg-amber-50/70")}
                          data-testid="schedule-import-label"
                          data-label={l.text}
                        >
                          <span className="min-w-0 flex-1 text-sm text-foreground">
                            « {l.text} » <span className="text-xs text-foreground/45">× {l.count}</span>
                            {unknown && <span className="ms-2 text-xs font-medium text-amber-700">{t("scheduleImport.unknown")}</span>}
                            {notInClass && <span className="ms-2 text-xs text-foreground/50">({t("scheduleImport.notInClass")})</span>}
                          </span>
                          <Select value={value} onValueChange={(v) => setMapping((m) => ({ ...m, [l.key]: v }))}>
                            <SelectTrigger className="h-9 w-full sm:w-60" data-testid="schedule-import-subject">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SKIP}>{t("scheduleImport.ignore")}</SelectItem>
                              {sortedSubjects.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">{t("scheduleImport.preview")}</h3>
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-sm" data-testid="schedule-import-preview">
                      <thead>
                        <tr className="border-b border-border bg-surface-muted/60 text-start text-xs font-medium text-foreground/55">
                          <th className="px-3 py-2 text-start">{t("schedule.day")}</th>
                          <th className="px-3 py-2 text-start">{t("schedule.time")}</th>
                          <th className="px-3 py-2 text-start">{t("scheduleImport.inFile")}</th>
                          <th className="px-3 py-2 text-start">{t("scheduleImport.subject")}</th>
                          <th className="px-3 py-2 text-start">{t("scheduleImport.room")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {parsed.slots.map((s, i) => {
                          const subjectId = subjectFor(s.label);
                          return (
                            <tr key={i} className={cn(subjectId === SKIP && "text-foreground/40 line-through")} data-testid="schedule-import-row">
                              <td className="px-3 py-1.5 capitalize">{dayLabel(s.dayOfWeek)}</td>
                              <td className="whitespace-nowrap px-3 py-1.5 tabular-nums" dir="ltr">
                                {formatTime(s.startMinutes)} – {formatTime(s.endMinutes)}
                              </td>
                              <td className="px-3 py-1.5">{s.label}</td>
                              <td className="px-3 py-1.5 font-medium">
                                {subjectId === SKIP ? t("scheduleImport.ignore") : subjectName.get(subjectId)}
                              </td>
                              <td className="px-3 py-1.5">{s.room ?? ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {targetClass && targetClass.slotCount > 0 && (
                  <label className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={replace}
                      onChange={(e) => setReplace(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-primary-600"
                      data-testid="schedule-import-replace"
                    />
                    <span>
                      <span className="font-medium text-foreground">
                        {t("scheduleImport.replace")
                          .replace("{n}", String(targetClass.slotCount))
                          .replace("{class}", targetClass.name)}
                      </span>
                      <span className="mt-0.5 block text-xs text-foreground/55">{t("scheduleImport.replaceHint")}</span>
                    </span>
                  </label>
                )}
              </>
            )}

            <DialogFooter>
              <Button variant="secondary" onClick={close}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={submit}
                disabled={importing || !targetClass || kept.length === 0}
                data-testid="schedule-import-submit"
              >
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("scheduleImport.submit").replace("{n}", String(kept.length))}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
