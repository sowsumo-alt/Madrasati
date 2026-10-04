"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatMRU } from "@/lib/format";
import { FREQUENCY_LABELS, TUITION_FREQUENCIES, monthLabel, monthStart, type TuitionFrequency } from "@/lib/tuition";
import type { TuitionSettings } from "@/lib/tuition-data";
import { MonthChips } from "./month-chips";

export interface TuitionChoiceValue {
  /** "NONE" : la formule sera choisie plus tard, depuis la fiche de l'élève. */
  frequency: TuitionFrequency | "NONE";
  customMonths: number;
  /** Montant d'un mois en MRU, en texte pendant la saisie. */
  monthly: string;
  /**
   * Mois réglés dès l'inscription, ISO : juin (le dernier mois, que beaucoup
   * d'écoles font payer d'avance), ou les premiers mois d'un élève inscrit
   * avant Madrasati. Enregistrés comme payés, sur le reçu de l'inscription.
   */
  paidMonths: string[];
}

/** Formule proposée d'office : mensuelle au montant de l'école, juin coché si l'école le demande. */
export function defaultTuitionChoice(settings: TuitionSettings): TuitionChoiceValue {
  const last = settings.yearMonths[settings.yearMonths.length - 1];
  return {
    frequency: settings.monthly ? "MONTHLY" : "NONE",
    customMonths: 4,
    monthly: settings.monthly ? String(settings.monthly) : "",
    paidMonths: settings.prepayLastMonth && last ? [last] : [],
  };
}

/**
 * Mois facturés pour une inscription à cette date : du mois d'inscription
 * (ramené dans l'année scolaire, comme le fait applyTuitionPlan) à la fin.
 */
export function billedMonthsFrom(yearMonths: string[], enrolledAt: Date): string[] {
  if (yearMonths.length === 0) return [];
  const month = monthStart(enrolledAt).toISOString();
  const first =
    month < yearMonths[0] ? yearMonths[0] : month > yearMonths[yearMonths.length - 1] ? yearMonths[yearMonths.length - 1] : month;
  return yearMonths.filter((m) => m >= first);
}

/** Les mois cochés qui sont bien facturés (après le mois d'inscription). */
export function chosenPaidMonths(value: TuitionChoiceValue, months: string[]): string[] {
  if (value.frequency === "NONE") return [];
  return value.paidMonths.filter((m) => months.includes(m));
}

/**
 * Choix de la formule de paiement des frais de scolarité à l'inscription :
 * mensuel, trimestriel, N mois en une fois, ou l'année entière. Le montant
 * d'un mois est celui de l'école (Paramètres), modifiable ici.
 */
export function TuitionChoice({
  value,
  onChange,
  months,
  hint,
}: {
  value: TuitionChoiceValue;
  onChange: (value: TuitionChoiceValue) => void;
  /** Mois facturés, ISO : de l'inscription à la fin de l'année. */
  months: string[];
  hint?: string;
}) {
  const options: (TuitionFrequency | "NONE")[] = [...TUITION_FREQUENCIES, "NONE"];
  const paid = chosenPaidMonths(value, months);
  const monthly = Number(value.monthly) || 0;
  return (
    <div className="space-y-3" data-testid="tuition-choice">
      <div className="flex flex-wrap gap-2">
        {options.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange({ ...value, frequency: f })}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              value.frequency === f
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-border bg-surface text-foreground/75 hover:bg-primary-50/60",
            )}
            data-testid={`enroll-frequency-${f}`}
          >
            {f === "NONE" ? "Plus tard" : FREQUENCY_LABELS[f]}
          </button>
        ))}
      </div>
      {value.frequency !== "NONE" && (
        <div className="flex flex-wrap items-end gap-3">
          {value.frequency === "CUSTOM" && (
            <div className="space-y-1.5">
              <Label htmlFor="enroll-custom-months">Mois réglés en une fois</Label>
              <Input
                id="enroll-custom-months"
                type="number"
                min={1}
                max={12}
                value={value.customMonths}
                onChange={(e) =>
                  onChange({ ...value, customMonths: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })
                }
                className="w-24"
                data-testid="enroll-custom-months"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="enroll-monthly">Montant d&apos;un mois (MRU)</Label>
            <Input
              id="enroll-monthly"
              type="number"
              min={1}
              value={value.monthly}
              onChange={(e) => onChange({ ...value, monthly: e.target.value })}
              className="w-40"
              data-testid="enroll-monthly"
            />
          </div>
        </div>
      )}
      {value.frequency !== "NONE" && months.length > 0 && (
        <div className="space-y-1.5">
          <Label>Mois payés aujourd&apos;hui</Label>
          <MonthChips months={months} value={value.paidMonths} onChange={(paidMonths) => onChange({ ...value, paidMonths })} />
          <p className="text-xs text-foreground/50">
            Touchez les mois que le parent règle avec l&apos;inscription — par exemple juin, le dernier mois.
          </p>
        </div>
      )}
      {paid.length > 0 && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900" data-testid="enroll-paid-summary">
          Payé aujourd&apos;hui : {paid.map((m) => monthLabel(new Date(m))).join(", ")}
          {monthly > 0 ? ` (${formatMRU(paid.length * monthly)})` : ""}, sur le même reçu que l&apos;inscription.{" "}
          {paid.length > 1 ? "Ces mois n'apparaîtront" : "Ce mois n'apparaîtra"} pas dans les impayés.
        </p>
      )}
      {hint && <p className="text-xs text-foreground/55">{hint}</p>}
    </div>
  );
}
