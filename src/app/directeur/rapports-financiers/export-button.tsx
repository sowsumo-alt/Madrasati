"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { financialReportRows } from "./actions";

/** Exporte en Excel les encaissements de la période affichée, et le résumé du rapport. */
export function ReportExportButton({
  yearId,
  month,
  fileLabel,
  summary,
}: {
  yearId: string;
  month: string | null;
  fileLabel: string;
  summary: Record<string, string | number>[];
}) {
  const [busy, setBusy] = useState(false);

  async function exportReport() {
    setBusy(true);
    try {
      const rows = await financialReportRows(yearId, month);
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), "Résumé");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Encaissements");
      XLSX.writeFile(workbook, `rapport-financier-${fileLabel}.xlsx`);
      toast.success(`Rapport exporté : ${rows.length} encaissement(s).`);
    } catch {
      toast.error("L'export n'a pas abouti. Vérifiez la connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" onClick={exportReport} disabled={busy} data-testid="report-export">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Exporter en Excel
    </Button>
  );
}
