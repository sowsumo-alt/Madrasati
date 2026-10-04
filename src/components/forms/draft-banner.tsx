"use client";

import { FileClock, RotateCcw } from "lucide-react";
import { draftTime } from "@/lib/form-draft";

/** Bandeau « Brouillon repris » : la saisie d'avant est revenue, on peut repartir de zéro. */
export function DraftBanner({ savedAt, onDiscard }: { savedAt: number; onDiscard: () => void }) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"
      data-testid="draft-banner"
    >
      <FileClock className="h-4 w-4 shrink-0 text-amber-600" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Brouillon repris</span> — saisie gardée le {draftTime(savedAt)}. Terminez
        l&apos;inscription quand vous voulez.
      </p>
      <button
        type="button"
        onClick={onDiscard}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-surface px-2.5 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100"
        data-testid="draft-discard"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Recommencer à zéro
      </button>
    </div>
  );
}
