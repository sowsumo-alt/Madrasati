"use client";

import { useState } from "react";
import { Check, ArrowRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMRU } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  PLANS,
  STUDENTS_MIN,
  STUDENTS_MAX,
  STUDENTS_STEP,
  STUDENTS_DEFAULT,
  ANNUAL_FREE_MONTHS,
  monthlyPrice,
  yearlyPrice,
} from "@/app/(marketing)/landing-config";

/**
 * Calculateur de tarif : le directeur place le curseur sur son nombre
 * d'élèves et lit immédiatement ce qu'il paiera, sans formulaire ni devis.
 */
export function PricingCalculator({ phone }: { phone: string }) {
  const [students, setStudents] = useState(STUDENTS_DEFAULT);
  const [annual, setAnnual] = useState(false);

  const progress =
    ((students - STUDENTS_MIN) / (STUDENTS_MAX - STUDENTS_MIN)) * 100;

  return (
    <div className="space-y-8">
      {/* — Curseur */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <label
              htmlFor="students"
              className="flex items-center gap-2 text-sm font-medium text-foreground/60"
            >
              <Users className="h-4 w-4" />
              Combien d&apos;élèves dans votre école ?
            </label>
            <p className="mt-2 text-4xl font-bold tracking-tight text-primary-800 sm:text-5xl">
              {students}
              {students >= STUDENTS_MAX && "+"}
              <span className="ml-2 text-base font-medium text-foreground/50">
                élèves
              </span>
            </p>
          </div>

          <div className="inline-flex rounded-full bg-surface-muted p-1 text-sm">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                "rounded-full px-4 py-2 font-medium transition-colors",
                !annual ? "bg-surface text-foreground shadow-sm" : "text-foreground/55",
              )}
            >
              Mensuel
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                "rounded-full px-4 py-2 font-medium transition-colors",
                annual ? "bg-surface text-foreground shadow-sm" : "text-foreground/55",
              )}
            >
              Annuel
              <span className="ml-1.5 text-xs font-semibold text-primary-600">
                −{ANNUAL_FREE_MONTHS} mois
              </span>
            </button>
          </div>
        </div>

        <input
          id="students"
          type="range"
          min={STUDENTS_MIN}
          max={STUDENTS_MAX}
          step={STUDENTS_STEP}
          value={students}
          onChange={(e) => setStudents(Number(e.target.value))}
          aria-valuetext={`${students} élèves`}
          className="range-brand mt-6 h-2 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background: `linear-gradient(to right, var(--primary-600) ${progress}%, var(--surface-muted) ${progress}%)`,
          }}
        />
        <div className="mt-2 flex justify-between text-xs text-foreground/40">
          <span>{STUDENTS_MIN} élèves</span>
          <span>{STUDENTS_MAX}+ élèves</span>
        </div>
      </div>

      {/* — Formules */}
      <div className="grid gap-5 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const perMonth = monthlyPrice(students, plan.multiplier);
          const perYear = yearlyPrice(students, plan.multiplier);
          const message = `Bonjour, je dirige une école de ${students} élèves et je suis intéressé par la formule ${plan.name} de Madrasati (${formatMRU(perMonth)} par mois).`;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-surface p-6 shadow-sm transition-transform duration-300 sm:p-7",
                plan.popular
                  ? "border-primary-600 ring-1 ring-primary-600 lg:-translate-y-2"
                  : "border-border",
              )}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-6 rounded-full bg-primary-700 px-3 py-1 text-xs font-semibold text-white">
                  Le plus choisi
                </span>
              )}

              <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
              <p className="mt-1 text-sm text-foreground/55">{plan.tagline}</p>

              <div className="mt-5">
                <p className="text-3xl font-bold tracking-tight text-primary-800">
                  {formatMRU(annual ? perYear : perMonth)}
                </p>
                <p className="mt-1 text-sm text-foreground/50">
                  {annual ? (
                    <>
                      par an · soit {formatMRU(Math.round(perYear / 12))} par mois
                    </>
                  ) : (
                    <>par mois · pour {students} élèves</>
                  )}
                </p>
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/75">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href={buildWhatsAppUrl(phone, message)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "mt-7 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold transition-colors",
                  plan.popular
                    ? "bg-primary-700 text-white hover:bg-primary-800"
                    : "border border-border text-primary-800 hover:bg-surface-muted",
                )}
              >
                Choisir {plan.name}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          );
        })}
      </div>

      <p className="text-center text-sm text-foreground/50">
        Sans engagement · Installation et reprise de vos données incluses ·
        Paiement en Ouguiya, espèces, virement, Masrvi ou Sedad
      </p>
    </div>
  );
}
