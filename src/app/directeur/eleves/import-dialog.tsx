"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { importStudents } from "./actions";
import { useLanguage } from "@/lib/i18n/language-provider";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HEADER_ALIASES: Record<string, string[]> = {
  firstName: ["prénom", "prenom", "first name", "firstname"],
  lastName: ["nom", "nom de famille", "last name", "lastname"],
  dateOfBirth: ["date de naissance", "birth date", "dateofbirth", "date de naissance (jj/mm/aaaa)"],
  gender: ["genre", "sexe", "gender"],
  className: ["classe", "class"],
};

function normalizeKey(key: string) {
  return key.trim().toLowerCase();
}

function mapRow(row: Record<string, unknown>) {
  const entries = Object.entries(row).map(([k, v]) => [normalizeKey(k), v] as const);
  const result: Record<string, string> = {};

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const match = entries.find(([k]) => aliases.includes(k));
    if (match && match[1] != null && match[1] !== "") {
      // Une cellule Excel formatée en date arrive ici comme un objet Date
      // JS (voir cellDates dans handleFile) : on la convertit en ISO plutôt
      // qu'en toString() du fuseau local, pour ne jamais glisser d'un jour
      // selon l'heure de la machine.
      const value = match[1];
      result[field] =
        value instanceof Date
          ? value.toISOString().slice(0, 10)
          : String(value).trim();
    }
  }
  return result as {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
    className?: string;
  };
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  async function handleFile(file: File) {
    setFileName(file.name);
    setIsImporting(true);
    try {
      const [XLSX, buffer] = await Promise.all([
        import("xlsx"),
        file.arrayBuffer(),
      ]);
      // cellDates : les cellules formatées en date arrivent en objets Date
      // JS plutôt qu'en numéro de série Excel brut (ex: 42078), qui sinon se
      // transformait silencieusement en date de naissance absurde ou nulle.
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });

      const mapped = rows.map(mapRow);
      const result = await importStudents(mapped);

      if (result.created > 0) {
        toast.success(`${result.created} ${t("students.createdCount")}`);
      }
      if (result.skipped.length > 0) {
        toast.warning(`${result.skipped.length} ${t("students.importSkipped")}`);
      }
      if (result.created === 0 && result.skipped.length === 0) {
        toast.error(t("students.importNoRows"));
      }
      if (result.unmatchedClassNames.length > 0) {
        toast.warning(
          `Classe(s) non reconnue(s), élèves importés sans classe : ${result.unmatchedClassNames.join(", ")}. Vérifiez l'orthographe ou créez ces classes d'abord.`,
          { duration: 10000 },
        );
      }
      if (result.missingDateCount > 0) {
        toast.warning(
          `${result.missingDateCount} date(s) de naissance illisible(s), importées vides. Utilisez le format JJ/MM/AAAA.`,
          { duration: 10000 },
        );
      }

      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(t("students.importReadError"));
    } finally {
      setIsImporting(false);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("students.importDialogTitle")}</DialogTitle>
          <DialogDescription>{t("students.importDescription")}</DialogDescription>
        </DialogHeader>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isImporting}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-muted px-6 py-10 text-center transition-colors hover:border-primary-400 disabled:opacity-60"
        >
          {isImporting ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          ) : fileName ? (
            <FileSpreadsheet className="h-8 w-8 text-primary-600" />
          ) : (
            <UploadCloud className="h-8 w-8 text-foreground/40" />
          )}
          <span className="text-sm font-medium text-foreground">
            {isImporting
              ? t("students.importInProgress")
              : fileName
                ? fileName
                : t("students.importChooseFile")}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
