"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { familyDataExport } from "../export-actions";

/** Demande d'accès des parents : toutes les données de la famille, en Excel. */
export function FamilyExportButton({ parentId }: { parentId: string }) {
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setBusy(true);
    try {
      const result = await familyDataExport(parentId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      for (const [name, rows] of Object.entries(result.sheets)) {
        const sheet = rows.length > 0 ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([["Aucune donnée"]]);
        XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
      }
      XLSX.writeFile(workbook, `${result.fileName}.xlsx`);
      toast.success("Données de la famille exportées.");
    } catch {
      toast.error("L'export n'a pas abouti. Vérifiez la connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" onClick={exportData} disabled={busy} data-testid="family-export">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Exporter ses données
    </Button>
  );
}
