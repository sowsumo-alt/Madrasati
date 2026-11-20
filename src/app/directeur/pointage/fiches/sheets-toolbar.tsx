"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportElementsToPdf } from "@/lib/pdf-export";

/** Imprimer, ou télécharger toutes les fiches affichées en un seul PDF (une page par fiche). */
export function SheetsToolbar({ fileName, month, recap, count }: { fileName: string; month: string; recap: boolean; count: number }) {
  const [progress, setProgress] = useState<string | null>(null);

  async function download() {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-sheet]"));
    if (elements.length === 0) return;
    setProgress(`0/${elements.length}`);
    try {
      await exportElementsToPdf(elements, fileName, (done, total) => setProgress(`${done}/${total}`));
    } catch {
      toast.error("La génération du PDF a échoué. Réessayez.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="ms-auto flex flex-wrap gap-2">
      <Link
        href={recap ? `/directeur/pointage/fiches?mois=${month}` : `/directeur/pointage/fiches?mois=${month}&recap=1`}
        className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted"
      >
        {recap ? "Voir les fiches" : "Voir le récapitulatif"}
      </Link>
      <Button variant="secondary" onClick={() => window.print()} disabled={count === 0}>
        <Printer className="h-4 w-4" />
        Imprimer
      </Button>
      <Button onClick={download} disabled={count === 0 || progress !== null} data-testid="sheets-pdf">
        {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {progress ? `PDF ${progress}` : recap ? "Télécharger le récapitulatif" : count > 1 ? "Télécharger toutes les fiches du mois" : "Télécharger la fiche"}
      </Button>
    </div>
  );
}
