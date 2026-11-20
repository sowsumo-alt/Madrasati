"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { monthLabelOf } from "@/lib/timesheet";

/** Choix du mois (?mois=AAAA-MM), en gardant les autres paramètres de l'adresse. */
export function MonthSelect({ months, value }: { months: string[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-foreground/70">Mois</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("mois", e.target.value);
          router.push(`${pathname}?${next.toString()}`);
        }}
        className="h-10 min-w-44 rounded-lg border border-border bg-surface px-3"
        data-testid="timesheet-month"
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {monthLabelOf(m)}
          </option>
        ))}
      </select>
    </label>
  );
}
