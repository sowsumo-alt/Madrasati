"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CirclePlus, CreditCard, FileSpreadsheet, Loader2, Users, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportSchools } from "./export-schools";
import type { SchoolRow } from "./types";

const TILE =
  "flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl px-3 py-4 text-center text-sm font-semibold transition-colors";

const TONES = {
  emerald: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/25",
  slate: "bg-surface-muted text-foreground/80 hover:bg-surface-muted/70",
  blue: "bg-blue-50 text-blue-800 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-100 dark:hover:bg-blue-500/25",
  violet: "bg-violet-50 text-violet-800 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-100 dark:hover:bg-violet-500/25",
};

function Tile({ icon: Icon, label, sub }: { icon: LucideIcon; label: string; sub?: string }) {
  return (
    <>
      <Icon className="h-6 w-6" strokeWidth={1.9} />
      <span>{label}</span>
      {sub && <span className="-mt-1.5 text-[11px] font-medium opacity-70">{sub}</span>}
    </>
  );
}

/** Raccourcis du Super Admin : inscrire une école, voir les paiements, exporter. */
export function QuickActions({ schools }: { schools: SchoolRow[] }) {
  const [exporting, setExporting] = useState(false);

  async function exportAll() {
    setExporting(true);
    try {
      toast.success(`${await exportSchools(schools)} école(s) exportée(s).`);
    } catch {
      toast.error("L'export a échoué.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-soft sm:p-5" data-testid="sa-quick-actions">
      <h2 className="flex items-center gap-2.5 text-base font-semibold text-foreground">
        <Zap className="h-5 w-5 text-amber-500" />
        Actions rapides
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* La création d'une école se fait par son directeur (inscription publique) : on l'ouvre à côté. */}
        <Link href="/inscription" target="_blank" className={cn(TILE, TONES.emerald)}>
          <Tile icon={CirclePlus} label="Ajouter une école" />
        </Link>
        <span className={cn(TILE, TONES.slate, "cursor-default opacity-70")} title="Bientôt disponible">
          <Tile icon={Users} label="Gérer les utilisateurs" sub="Bientôt" />
        </span>
        <Link href="#ecoles" className={cn(TILE, TONES.blue)}>
          <Tile icon={CreditCard} label="Voir les paiements" />
        </Link>
        <button type="button" onClick={exportAll} disabled={exporting} className={cn(TILE, TONES.violet, "disabled:opacity-60")}>
          {exporting ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Tile icon={FileSpreadsheet} label="Rapports financiers" sub="Export Excel" />
          )}
        </button>
      </div>
    </section>
  );
}
