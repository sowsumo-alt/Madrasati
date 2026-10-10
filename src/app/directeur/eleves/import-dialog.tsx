"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClassLevelPicker, EMPTY_CLASS_LEVEL, type ClassLevelValue } from "@/components/classes/class-level-picker";
import { composeClassName, type CatalogGroup } from "@/lib/class-catalog";
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  buildImportPreview,
  findHeaderRow,
  findTitle,
  suggestClassFromTitle,
  suggestField,
  type ImportCell,
  type ImportField,
  type ImportedStudent,
} from "@/lib/student-import";
import { ClassSelectItems } from "@/components/classes/class-select-items";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import { importStudentList, takenNnis } from "./import-actions";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Classes de l'année en cours. */
  classes: { id: string; name: string; category?: string | null }[];
  /** Catégories et niveaux proposés pour créer la classe sur place. */
  catalog: CatalogGroup[];
}

interface LoadedFile {
  name: string;
  rows: ImportCell[][];
  headerRow: number;
  title: string | null;
  columns: { index: number; header: string; samples: string[] }[];
}

type ClassMode = "existing" | "new" | "none";

const sameText = (a: string, b: string) =>
  a.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase() ===
  b.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();

const cellText = (v: ImportCell) =>
  v instanceof Date ? v.toLocaleDateString("fr-FR") : String(v ?? "").trim();

/**
 * Import d'une liste d'élèves depuis le fichier Excel de l'école, tel quel.
 * Madrasati reconnaît les colonnes habituelles, sépare « Prénoms et Nom »,
 * laisse de côté les totaux, et montre tout avant d'enregistrer : le
 * directeur corrige une correspondance ou un nom, choisit la classe (ou la
 * crée ici), puis confirme.
 */
export function ImportDialog({ open, onOpenChange, classes, catalog }: ImportDialogProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [mapping, setMapping] = useState<ImportField[]>([]);
  const [edits, setEdits] = useState<Record<number, { firstName: string; lastName: string }>>({});
  const [taken, setTaken] = useState<Record<string, string>>({});
  const [classMode, setClassMode] = useState<ClassMode>("existing");
  const [classId, setClassId] = useState("");
  const [newClass, setNewClass] = useState<ClassLevelValue>(EMPTY_CLASS_LEVEL);
  const [importing, setImporting] = useState(false);

  function reset() {
    setFile(null);
    setMapping([]);
    setEdits({});
    setTaken({});
    setClassMode("existing");
    setClassId("");
    setNewClass(EMPTY_CLASS_LEVEL);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(f: File) {
    setReading(true);
    try {
      const [XLSX, buffer] = await Promise.all([import("xlsx"), f.arrayBuffer()]);
      // cellDates : une date Excel arrive en objet Date, pas en numéro de série.
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<ImportCell[]>(sheet, { header: 1, defval: "", raw: true });
      if (rows.length === 0) {
        toast.error(t("students.importNoRows"));
        return;
      }

      const found = findHeaderRow(rows);
      const headerRow = found === -1 ? 0 : found;
      const data = rows.slice(headerRow + 1);
      const width = Math.max(...rows.slice(headerRow, headerRow + 50).map((r) => r.length));
      const columns = Array.from({ length: width }, (_, index) => ({
        index,
        header: cellText(rows[headerRow]?.[index]),
        samples: data.map((r) => cellText(r[index])).filter(Boolean).slice(0, 8),
      })).filter((c) => c.header || c.samples.length > 0);

      const suggested: ImportField[] = Array.from({ length: width }, () => "ignore");
      const used = new Set<ImportField>();
      for (const c of columns) {
        const field = suggestField(c.header, c.samples);
        // Deux colonnes ne reçoivent pas le même champ : la première l'emporte.
        if (field !== "ignore" && !used.has(field)) {
          suggested[c.index] = field;
          used.add(field);
        }
      }

      const title = findTitle(rows, headerRow);
      const loaded: LoadedFile = { name: f.name, rows, headerRow, title, columns };
      setFile(loaded);
      setMapping(suggested);
      setEdits({});

      // La classe : celle qui porte déjà le nom du titre, sinon on propose
      // de la créer d'après le titre (« JARDIN » → Préscolaire / Jardin).
      const suggestion = suggestClassFromTitle(title);
      const wanted = suggestion ? composeClassName(suggestion.level, suggestion.section) : null;
      const existing = title
        ? classes.find((c) => sameText(c.name, title) || (wanted != null && sameText(c.name, wanted)))
        : null;
      if (existing) {
        setClassMode("existing");
        setClassId(existing.id);
      } else if (suggestion) {
        setClassMode("new");
        setNewClass({ category: suggestion.category, level: suggestion.level, section: suggestion.section });
      } else {
        setClassMode(classes.length > 0 ? "existing" : "new");
      }
    } catch {
      toast.error(t("students.importReadError"));
    } finally {
      setReading(false);
    }
  }

  const preview = useMemo(
    () => (file ? buildImportPreview(file.rows, file.headerRow, mapping) : null),
    [file, mapping],
  );

  // Les NNI déjà connus de l'école : ces élèves sont sans doute déjà inscrits.
  const nniKey = preview?.students.map((s) => s.nni ?? "").join(",") ?? "";
  useEffect(() => {
    const nnis = nniKey.split(",").filter(Boolean);
    if (nnis.length === 0) {
      setTaken({});
      return;
    }
    let cancelled = false;
    takenNnis(nnis)
      .then((result) => !cancelled && setTaken(result))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [nniKey]);

  const review = useMemo(() => {
    if (!preview) return null;
    const ready: ImportedStudent[] = [];
    const errors = [...preview.errors];
    for (const s of preview.students) {
      const edit = edits[s.row];
      const student = edit ? { ...s, firstName: edit.firstName.trim(), lastName: edit.lastName.trim() } : s;
      if (student.nni && taken[student.nni]) {
        errors.push({ row: s.row, reason: `Déjà inscrit (${taken[student.nni]})`, text: `${s.firstName} ${s.lastName}` });
      } else {
        ready.push(student);
      }
    }
    errors.sort((a, b) => a.row - b.row);
    // Un nom effacé en cours de correction garde sa ligne dans le tableau ;
    // il bloque seulement l'import tant qu'il reste vide.
    // Un nom de famille vide est permis (élève à un seul nom, signalé) ; un prénom vide, non.
    const blank = ready.filter((s) => !s.firstName).length;
    return { ready, errors, ignored: preview.ignored, blank };
  }, [preview, edits, taken]);

  const classReady =
    classMode === "none" ||
    (classMode === "existing" && Boolean(classId)) ||
    (classMode === "new" && Boolean(newClass.category.trim() && newClass.level.trim()));
  const hasName = mapping.includes("fullName") || (mapping.includes("firstName") && mapping.includes("lastName"));

  async function confirmImport() {
    if (!review || review.ready.length === 0) return;
    setImporting(true);
    try {
      const result = await importStudentList({
        students: review.ready.map((s) => ({
          firstName: s.firstName,
          lastName: s.lastName,
          dateOfBirth: s.dateOfBirth,
          placeOfBirth: s.placeOfBirth,
          gender: s.gender,
          nni: s.nni,
          rimNumber: s.rimNumber,
          nationality: s.nationality,
          phone: s.phone,
          className: s.className,
        })),
        target:
          classMode === "existing"
            ? { mode: "existing", classId }
            : classMode === "new"
              ? { mode: "new", category: newClass.category, level: newClass.level, section: newClass.section }
              : { mode: "none" },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${result.created} élève(s) importé(s)` +
          (result.className ? ` en ${result.className}` : "") +
          (result.classCreated ? " (classe créée)" : "") +
          ".",
      );
      onOpenChange(false);
      reset();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className={file ? "max-w-5xl" : undefined}>
        <DialogHeader>
          <DialogTitle>{t("students.importDialogTitle")}</DialogTitle>
          <DialogDescription>
            {file
              ? `${file.name} — vérifiez la classe, les colonnes et la liste, puis confirmez.`
              : "Choisissez le fichier Excel de votre école tel quel : Madrasati reconnaît ses colonnes et vous montre la liste avant d'importer."}
          </DialogDescription>
        </DialogHeader>

        {!file && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={reading}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-muted px-6 py-10 text-center transition-colors hover:border-primary-400 disabled:opacity-60"
            >
              {reading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              ) : (
                <UploadCloud className="h-8 w-8 text-foreground/40" />
              )}
              <span className="text-sm font-medium text-foreground">
                {reading ? t("students.importInProgress") : t("students.importChooseFile")}
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              data-testid="import-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </>
        )}

        {file && review && (
          <div className="space-y-6">
            {/* 1. CLASSE */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">1. Classe de ces élèves</h3>
              {file.title && (
                <p className="text-sm text-foreground/60">
                  Titre trouvé au-dessus du tableau : <strong className="text-foreground">{file.title}</strong>
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["existing", "Classe existante"],
                    ["new", "Créer une nouvelle classe"],
                    ["none", "Sans classe pour l'instant"],
                  ] as [ClassMode, string][]
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setClassMode(mode)}
                    disabled={mode === "existing" && classes.length === 0}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40",
                      classMode === mode
                        ? "border-primary-600 bg-primary-600 text-white"
                        : "border-border bg-surface text-foreground/75 hover:bg-primary-50/60",
                    )}
                    data-testid={`class-mode-${mode}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {classMode === "existing" && (
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger className="sm:w-72" data-testid="import-class-select">
                    <SelectValue placeholder="Choisir la classe" />
                  </SelectTrigger>
                  <SelectContent>
                    <ClassSelectItems classes={classes} />
                  </SelectContent>
                </Select>
              )}
              {classMode === "new" && (
                <div className="rounded-xl border border-border p-4">
                  <ClassLevelPicker
                    key={file.name}
                    catalog={catalog}
                    takenNames={classes.map((c) => c.name)}
                    value={newClass}
                    onChange={setNewClass}
                  />
                </div>
              )}
            </section>

            {/* 2. COLONNES */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">2. Colonnes de votre fichier</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {file.columns.map((c) => (
                  <div key={c.index} className="rounded-xl border border-border p-3" data-testid={`column-${c.index}`}>
                    <p className="truncate text-sm font-semibold text-foreground">
                      {c.header || `Colonne ${c.index + 1} (sans titre)`}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-foreground/50">
                      {c.samples.slice(0, 2).join(" · ") || "—"}
                    </p>
                    <Select
                      value={mapping[c.index] ?? "ignore"}
                      onValueChange={(v) =>
                        setMapping((m) => {
                          const next = [...m];
                          // Un champ ne va qu'à une colonne : l'ancienne est libérée.
                          const previous = next.indexOf(v as ImportField);
                          if (v !== "ignore" && previous !== -1) next[previous] = "ignore";
                          next[c.index] = v as ImportField;
                          return next;
                        })
                      }
                    >
                      <SelectTrigger className="mt-2 h-9" data-testid={`mapping-${c.index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IMPORT_FIELDS.map((field) => (
                          <SelectItem key={field} value={field}>
                            {IMPORT_FIELD_LABELS[field]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {!hasName && (
                <p className="flex items-center gap-2 text-sm text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  Indiquez la colonne du nom : « Prénom et nom (ensemble) », ou « Prénom » et « Nom de famille ».
                </p>
              )}
            </section>

            {/* 3. RÉSUMÉ ET LISTE */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">3. Vérification</h3>
              <div
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-primary-50/70 px-4 py-3 text-sm"
                data-testid="import-summary"
              >
                <span className="flex items-center gap-1.5 font-semibold text-primary-800">
                  <CheckCircle2 className="h-4 w-4" />
                  {review.ready.length} élève(s) prêt(s) à importer
                </span>
                <span className="text-foreground/60">
                  {review.ignored.length} ligne(s) ignorée(s)
                  {review.ignored.some((i) => i.reason === "Ligne de total") ? " (totaux, lignes vides)" : ""}
                </span>
                <span className={review.errors.length > 0 ? "font-medium text-red-700" : "text-foreground/60"}>
                  {review.errors.length} erreur(s)
                </span>
                {review.blank > 0 && (
                  <span className="font-medium text-amber-700">{review.blank} nom(s) à compléter</span>
                )}
              </div>

              {review.ready.length > 0 && (
                <div className="max-h-80 overflow-auto rounded-xl border border-border">
                  <table className="w-full text-sm" data-testid="import-preview">
                    <thead className="sticky top-0 bg-surface-muted text-left text-xs uppercase tracking-wide text-foreground/50">
                      <tr>
                        <th className="px-3 py-2">Ligne</th>
                        <th className="px-3 py-2">Prénom</th>
                        <th className="px-3 py-2">Nom</th>
                        <th className="px-3 py-2">Naissance</th>
                        <th className="px-3 py-2">Genre</th>
                        <th className="px-3 py-2">NNI</th>
                        <th className="px-3 py-2">N° RIM</th>
                        <th className="px-3 py-2">Tél. parent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {review.ready.map((s) => (
                        <tr key={s.row}>
                          <td className="px-3 py-1.5 text-foreground/50">{s.row}</td>
                          <td className="px-2 py-1">
                            <Input
                              className="h-8 min-w-[9rem]"
                              value={s.firstName}
                              aria-label={`Prénom ligne ${s.row}`}
                              onChange={(e) =>
                                setEdits((ed) => ({ ...ed, [s.row]: { firstName: e.target.value, lastName: s.lastName } }))
                              }
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              className="h-8 min-w-[8rem]"
                              value={s.lastName}
                              aria-label={`Nom ligne ${s.row}`}
                              onChange={(e) =>
                                setEdits((ed) => ({ ...ed, [s.row]: { firstName: s.firstName, lastName: e.target.value } }))
                              }
                            />
                          </td>
                          <td className="px-3 py-1.5 text-foreground/70">
                            {[s.placeOfBirth, s.dateOfBirth?.split("-").reverse().join("/")].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td className="px-3 py-1.5 text-foreground/70">{s.gender ?? "—"}</td>
                          <td className="px-3 py-1.5 font-mono text-xs text-foreground/70" dir="ltr">
                            {s.nni ?? "—"}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-foreground/70" dir="ltr">
                            {s.rimNumber ?? "—"}
                          </td>
                          <td className="px-3 py-1.5 text-foreground/70" dir="ltr">
                            {s.phone ?? "—"}
                            {s.warnings.length > 0 && (
                              <span className="block text-xs text-amber-700">{s.warnings.join(" · ")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(review.errors.length > 0 || review.ignored.length > 0) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {review.errors.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 text-sm" data-testid="import-errors">
                      <p className="font-semibold text-red-800">Non importées (à vérifier)</p>
                      <ul className="mt-1 space-y-0.5 text-red-900/80">
                        {review.errors.map((e) => (
                          <li key={`${e.row}-${e.reason}`}>
                            Ligne {e.row} : {e.reason} — <span className="text-red-900/60">{e.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {review.ignored.length > 0 && (
                    <div className="rounded-xl border border-border bg-surface-muted p-3 text-sm" data-testid="import-ignored">
                      <p className="font-semibold text-foreground/80">Ignorées automatiquement</p>
                      <ul className="mt-1 space-y-0.5 text-foreground/60">
                        {review.ignored.map((i) => (
                          <li key={i.row}>
                            Ligne {i.row} : {i.reason} — {i.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        <DialogFooter>
          {file ? (
            <>
              <Button type="button" variant="secondary" onClick={reset} disabled={importing}>
                <FileSpreadsheet className="h-4 w-4" />
                Autre fichier
              </Button>
              <Button
                type="button"
                onClick={confirmImport}
                disabled={importing || !review || review.ready.length === 0 || review.blank > 0 || !classReady || !hasName}
                data-testid="import-confirm"
              >
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                Importer {review?.ready.length ?? 0} élève(s)
              </Button>
            </>
          ) : (
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t("common.close")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
