"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, UserPlus, UsersRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatMRU, formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface FamilyListRow {
  id: string;
  name: string;
  parent: string;
  phone: string;
  /** Élèves actifs. */
  students: number;
  /** Aucun élève actif : famille archivée. */
  archived: boolean;
  paid: number;
  /** Reste dû à ce jour. */
  due: number;
  /** Mois pas encore arrivés. */
  upcoming: number;
}

const norm = (v: string) => v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Toutes les familles d'un coup d'œil : élèves, versé, reste dû. */
export function FamiliesView({ rows }: { rows: FamilyListRow[] }) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const shown = useMemo(() => {
    const words = norm(query).split(/\s+/).filter(Boolean);
    return rows.filter(
      (r) =>
        (showArchived || !r.archived) &&
        words.every((w) => norm(`${r.name} ${r.parent} ${r.phone}`).includes(w)),
    );
  }, [rows, query, showArchived]);
  const totals = shown.reduce((acc, r) => ({ paid: acc.paid + r.paid, due: acc.due + r.due }), { paid: 0, due: 0 });

  return (
    <div className="space-y-5" data-testid="families-view">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <UsersRound className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Familles</h1>
            <p className="text-sm text-foreground/60">
              {shown.length} famille(s) · versé {formatMRU(totals.paid)} · reste dû à ce jour {formatMRU(totals.due)}
            </p>
          </div>
        </div>
        <Link href="/directeur/familles/inscription" className={buttonVariants()}>
          <UserPlus className="h-4 w-4" />
          Inscrire une famille
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une famille, un parent, un téléphone…"
            className="h-10 w-full rounded-lg border border-border bg-surface pe-3 ps-9 text-sm"
            data-testid="families-search"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground/70">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Afficher les familles archivées
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-surface shadow-soft">
        <table className="w-full min-w-[40rem] text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead className="bg-surface-muted/60 text-xs text-foreground/60">
            <tr>
              <th className="px-4 py-2.5 text-start font-semibold">Famille</th>
              <th className="px-3 py-2.5 text-center font-semibold">Élèves</th>
              <th className="px-3 py-2.5 text-end font-semibold">Versé</th>
              <th className="px-3 py-2.5 text-end font-semibold">Reste dû à ce jour</th>
              <th className="px-4 py-2.5 text-end font-semibold">À venir</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-foreground/50">
                  Aucune famille.
                </td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-border/60 hover:bg-surface-muted/40" data-testid="family-row">
                <td className="px-4 py-2.5">
                  <Link href={`/directeur/familles/${r.id}`} className="font-semibold text-primary-800 hover:underline">
                    {r.name}
                  </Link>
                  {r.archived && (
                    <span className="ms-2 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-foreground/60">
                      Archivée
                    </span>
                  )}
                  <span className="block text-xs text-foreground/55">
                    {r.parent} · <span dir="ltr">{formatPhone(r.phone)}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center">{r.students}</td>
                <td className="px-3 py-2.5 text-end font-medium text-emerald-700">{formatMRU(r.paid)}</td>
                <td className={cn("px-3 py-2.5 text-end font-semibold", r.due > 0 ? "text-amber-700" : "text-foreground/45")}>
                  {r.due > 0 ? formatMRU(r.due) : "À jour"}
                </td>
                <td className="px-4 py-2.5 text-end text-foreground/60">{formatMRU(r.upcoming)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
