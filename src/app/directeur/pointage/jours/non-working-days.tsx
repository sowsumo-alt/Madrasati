"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dmy } from "@/lib/timesheet";
import { addNonWorkingDays, deleteNonWorkingDay } from "../actions";

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export function NonWorkingDays({
  days,
  readOnly,
}: {
  days: { id: string; name: string; date: string; national: boolean }[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const result = await addNonWorkingDays({ name, from, to: to || from });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.added > 0 ? `${result.added} jour(s) ajouté(s).` : "Ces jours étaient déjà non travaillés.");
      setName("");
      setFrom("");
      setTo("");
      router.refresh();
    } catch {
      toast.error("L'ajout n'a pas abouti. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const result = await deleteNonWorkingDay(id).catch(() => null);
    if (!result?.ok) {
      toast.error(result?.error ?? "Le retrait n'a pas abouti.");
      return;
    }
    toast.success("Jour retiré : il redevient travaillé.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft" data-testid="add-non-working">
          <label className="block min-w-56 flex-1 space-y-1 text-sm">
            <span className="font-medium text-foreground/70">Motif</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex. : Vacances d'hiver" className="h-10 w-full rounded-lg border border-border bg-surface px-3" data-testid="nw-name" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground/70">Du</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-lg border border-border bg-surface px-3" data-testid="nw-from" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground/70">Au (facultatif)</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-10 rounded-lg border border-border bg-surface px-3" data-testid="nw-to" />
          </label>
          <Button onClick={add} disabled={busy || !from} data-testid="nw-add">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Ajouter
          </Button>
        </div>
      )}

      {days.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-foreground/60">Aucun jour non travaillé cette année.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface shadow-soft" data-testid="non-working-days">
          {days.map((d) => {
            const date = new Date(d.date);
            return (
              <li key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-28 font-medium tabular-nums">{dmy(date)}</span>
                <span className="w-20 text-foreground/60">{WEEKDAYS[date.getUTCDay()]}</span>
                <span className="min-w-0 flex-1">{d.name}</span>
                {d.national ? (
                  <span className="text-xs text-foreground/50">Férié national</span>
                ) : (
                  !readOnly && (
                    <button type="button" onClick={() => remove(d.id)} className="rounded-lg p-1.5 text-foreground/50 hover:bg-red-50 hover:text-red-700" aria-label={`Retirer ${d.name} du ${dmy(date)}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
