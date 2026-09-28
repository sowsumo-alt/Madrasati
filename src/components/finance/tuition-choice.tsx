"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FREQUENCY_LABELS, TUITION_FREQUENCIES, type TuitionFrequency } from "@/lib/tuition";

export interface TuitionChoiceValue {
  /** "NONE" : la formule sera choisie plus tard, depuis la fiche de l'élève. */
  frequency: TuitionFrequency | "NONE";
  customMonths: number;
  /** Montant d'un mois en MRU, en texte pendant la saisie. */
  monthly: string;
}

/**
 * Choix de la formule de paiement des frais de scolarité à l'inscription :
 * mensuel, trimestriel, N mois en une fois, ou l'année entière. Le montant
 * d'un mois est celui de l'école (Paramètres), modifiable ici.
 */
export function TuitionChoice({
  value,
  onChange,
  hint,
}: {
  value: TuitionChoiceValue;
  onChange: (value: TuitionChoiceValue) => void;
  hint?: string;
}) {
  const options: (TuitionFrequency | "NONE")[] = [...TUITION_FREQUENCIES, "NONE"];
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
      {hint && <p className="text-xs text-foreground/55">{hint}</p>}
    </div>
  );
}
