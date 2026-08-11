"use client";

import { useState } from "react";
import { Check, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMRU } from "@/lib/format";
import {
  PLANS,
  STUDENTS_MIN,
  STUDENTS_MAX,
  STUDENTS_STEP,
  STUDENTS_DEFAULT,
  monthlyPrice,
} from "@/app/(marketing)/landing-config";

/**
 * Estimation de prix affichée pendant l'inscription : le directeur voit ce
 * qu'il paiera avant même de créer son école. Rien n'est facturé à la
 * création — c'est une indication, pas un paiement — donc rien ici n'est
 * envoyé au serveur.
 */
export function PlanEstimate() {
  const [students, setStudents] = useState(STUDENTS_DEFAULT);
  const [planId, setPlanId] = useState(PLANS.find((p) => p.popular)?.id ?? PLANS[0].id);
  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[0];
  const price = monthlyPrice(students, plan.multiplier);
  const progress = ((students - STUDENTS_MIN) / (STUDENTS_MAX - STUDENTS_MIN)) * 100;

  return (
    <div className="rounded-2xl bg-primary-800 p-6 text-white sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-300">
        Estimation de votre abonnement
      </p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <label htmlFor="signup-students" className="flex items-center gap-2 text-sm text-white/70">
          <Users className="h-4 w-4" />
          Nombre d&apos;élèves
        </label>
        <span className="text-lg font-bold tabular-nums">
          {students}
          {students >= STUDENTS_MAX && "+"}
        </span>
      </div>
      <input
        id="signup-students"
        type="range"
        min={STUDENTS_MIN}
        max={STUDENTS_MAX}
        step={STUDENTS_STEP}
        value={students}
        onChange={(e) => setStudents(Number(e.target.value))}
        aria-valuetext={`${students} élèves`}
        className="range-brand range-brand-dark mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(to right, var(--accent-400) ${progress}%, rgba(255,255,255,0.2) ${progress}%)`,
        }}
      />

      <div className="mt-5 flex gap-2">
        {PLANS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlanId(p.id)}
            className={cn(
              "flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors",
              p.id === planId
                ? "bg-accent-400 text-primary-900"
                : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white",
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="mt-5 border-t border-white/15 pt-5">
        <p className="text-3xl font-bold tracking-tight">
          {formatMRU(price)}
          <span className="ml-1 text-sm font-medium text-white/60">/ mois</span>
        </p>
        <p className="mt-1 text-xs text-white/55">Formule {plan.name} · {plan.tagline}</p>
      </div>

      <ul className="mt-4 space-y-1.5">
        {plan.features.slice(0, 3).map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-white/70">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-300" />
            {f}
          </li>
        ))}
      </ul>

      <p className="mt-5 text-xs text-white/50">
        Estimation indicative. Créer votre école est gratuit et sans carte
        bancaire — nous confirmons votre formule ensemble ensuite.
      </p>
    </div>
  );
}
