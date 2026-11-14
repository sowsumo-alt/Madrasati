"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-provider";
import { studentsParamsOf, type StudentsListState } from "@/lib/students-query";
import { studentsWordExport } from "../export-actions";

/** La liste affichée (filtres compris, toutes pages), en Word : une page par classe. */
export function StudentsWordButton({ state }: { state: StudentsListState }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  async function exportWord() {
    setBusy(true);
    try {
      const result = await studentsWordExport(studentsParamsOf({ ...state, page: 1 }));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Chargés au clic seulement : la bibliothèque Word ne pèse rien sur la liste.
      const [{ Packer }, { buildStudentsDocument, studentsWordFileName }] = await Promise.all([
        import("docx"),
        import("@/lib/students-word"),
      ]);
      const blob = await Packer.toBlob(buildStudentsDocument(result.data));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = studentsWordFileName(result.data);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(t("students.exportWordDone"));
    } catch {
      toast.error(t("students.exportWordFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" className="h-11 px-4" onClick={exportWord} disabled={busy} data-testid="students-word-export">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      {t("students.exportWord")}
    </Button>
  );
}
