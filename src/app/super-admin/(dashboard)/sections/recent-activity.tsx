"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "./types";

const DOT: Record<ActivityItem["kind"], string> = {
  school: "bg-emerald-500",
  payment: "bg-blue-500",
  pending: "bg-rose-500",
};

const SHOWN = 5;

/** Dernières inscriptions d'écoles et derniers paiements d'abonnement. */
export function RecentActivity({ items }: { items: ActivityItem[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, SHOWN);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-soft sm:p-5" data-testid="sa-activity">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-base font-semibold text-foreground">
          <Clock className="h-5 w-5 text-foreground/60" />
          Activité récente
        </h2>
        {items.length > SHOWN && (
          <button
            type="button"
            onClick={() => setAll((a) => !a)}
            className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
          >
            {all ? "Voir moins" : "Voir tout"}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-foreground/50">Aucune activité pour l&apos;instant.</p>
      ) : (
        <ol className="relative mt-4 space-y-4 before:absolute before:inset-y-1 before:start-[5px] before:w-px before:bg-border">
          {shown.map((item) => (
            <li key={item.id} className="relative flex gap-3 ps-6" data-testid="sa-activity-item">
              <span className={cn("absolute start-0 top-1.5 h-[11px] w-[11px] rounded-full ring-4 ring-surface", DOT[item.kind])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="truncate text-xs text-foreground/55">{item.detail}</p>
              </div>
              <span className="shrink-0 text-xs text-foreground/50">{item.when}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
