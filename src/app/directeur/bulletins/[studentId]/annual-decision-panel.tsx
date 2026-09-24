"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Lightbulb, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import {
  DECISIONS,
  HONORS,
  decisionLabel,
  type DecisionKey,
  type HonorKey,
} from "@/lib/annual-decision";
import { saveAnnualDecision } from "../actions";

/**
 * Fin d'année, côté directeur : cocher les mentions du conseil et choisir la
 * décision de passage. Madrasati affiche sa suggestion d'après le seuil de
 * l'école, mais ne coche rien : c'est le choix du directeur qui s'imprime,
 * et qui apparaîtra sur la page Réinscription. Jamais imprimé lui-même.
 */
export function AnnualDecisionPanel({
  studentId,
  average,
  threshold,
  suggestion,
  initialHonors,
  initialDecision,
  validatedAt,
}: {
  studentId: string;
  average: number | null;
  threshold: number;
  suggestion: DecisionKey | null;
  initialHonors: HonorKey[];
  initialDecision: DecisionKey | null;
  validatedAt: string | null;
}) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [honors, setHonors] = useState<HonorKey[]>(initialHonors);
  const [decision, setDecision] = useState<DecisionKey | null>(initialDecision);
  const [saving, setSaving] = useState(false);

  const dirty =
    decision !== initialDecision ||
    honors.length !== initialHonors.length ||
    honors.some((h) => !initialHonors.includes(h));
  const label = (item: { fr: string; ar: string }) => (locale === "ar" ? item.ar : item.fr);
  const averageText = average != null ? average.toFixed(2).replace(".", ",") : "—";
  const thresholdText = String(threshold).replace(".", ",");

  async function handleSave() {
    setSaving(true);
    try {
      await saveAnnualDecision(studentId, { honors, decision });
      toast.success(t("annual.saved"));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="no-print mx-auto mt-4 max-w-[900px] space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-soft"
      data-testid="decision-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{t("annual.panelTitle")}</h2>
        {validatedAt && initialDecision && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("annual.validatedOn").replace("{date}", validatedAt)}
          </span>
        )}
      </div>

      {/* La suggestion, jamais appliquée d'office */}
      <p
        className="flex gap-2 rounded-xl bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-900"
        data-testid="decision-suggestion"
      >
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          {suggestion
            ? t(suggestion === "PROMOTED" ? "annual.suggestPromoted" : "annual.suggestRepeat")
                .replace("{average}", averageText)
                .replace("{threshold}", thresholdText)
                .replace("{decision}", label(decisionLabel(suggestion)!))
            : t("annual.noSuggestion")}
        </span>
      </p>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground/70">{t("annual.honors")}</p>
        <div className="flex flex-wrap gap-2">
          {HONORS.map((h) => {
            const on = honors.includes(h.key);
            return (
              <button
                key={h.key}
                type="button"
                onClick={() =>
                  setHonors((list) => (on ? list.filter((k) => k !== h.key) : [...list, h.key]))
                }
                aria-pressed={on}
                data-testid={`honor-${h.key}`}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  on
                    ? "border-primary-400 bg-primary-100/70 text-primary-800"
                    : "border-border bg-surface text-foreground/65 hover:bg-primary-50/40",
                )}
              >
                {label(h)}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground/70">{t("annual.decision")}</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {DECISIONS.map((d) => {
            const on = decision === d.key;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setDecision(on ? null : d.key)}
                aria-pressed={on}
                data-testid={`decision-${d.key}`}
                className={cn(
                  "rounded-xl border px-4 py-3 text-start text-sm font-semibold transition-colors",
                  on
                    ? "border-primary-500 bg-primary-50 text-primary-900 ring-1 ring-primary-400"
                    : "border-border bg-surface text-foreground/75 hover:bg-primary-50/40",
                )}
              >
                {label(d)}
                {suggestion === d.key && (
                  <span className="mt-0.5 block text-xs font-normal text-amber-700">
                    {t("annual.suggested")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !dirty} data-testid="save-decision">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("annual.save")}
        </Button>
      </div>
    </section>
  );
}
