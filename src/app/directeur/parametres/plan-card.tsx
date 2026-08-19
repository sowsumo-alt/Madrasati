"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMRU } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { CONTACT_PHONE } from "@/lib/contact";
import {
  PLANS,
  PLAN_LABELS,
  PLAN_LABEL_KEYS,
  PLAN_PRICE,
  PLAN_FEATURE_LIST,
  STANDARD_FEATURE_KEYS,
  FEATURE_LABEL_KEYS,
  IS_FEATURE_LIVE,
  TRIAL_REMINDER_DAYS,
  type Plan,
} from "@/lib/plans";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { requestPlanUpgrade } from "./actions";
import { useLanguage } from "@/lib/i18n/language-provider";

export function PlanCard({
  currentPlan,
  schoolName,
  studentCount,
  trialDaysLeft,
}: {
  currentPlan: Plan;
  schoolName: string;
  studentCount: number;
  /** Jours restants avant la fin de l'essai gratuit, `null` hors période d'essai. */
  trialDaysLeft: number | null;
}) {
  const { t } = useLanguage();
  // Les libellés de formule sont désignés par des clés construites ailleurs
  // (src/lib/plans.ts) : ce petit adaptateur évite d'avoir à élargir le type
  // TranslationKey, qui sert justement à garantir qu'aucune clé n'existe en
  // français sans exister aussi en anglais et en arabe.
  const tk = (key: string) => t(key as TranslationKey);
  const [requestingPlan, setRequestingPlan] = useState<Plan | null>(null);
  const [requested, setRequested] = useState<Plan | null>(null);

  async function handleRequest(plan: Plan) {
    setRequestingPlan(plan);
    try {
      await requestPlanUpgrade(plan);
      setRequested(plan);
      toast.success(t("plan.requestSaved"));
      window.open(
        buildWhatsAppUrl(
          CONTACT_PHONE,
          `Bonjour, je dirige l'école ${schoolName} sur Madrasati (formule actuelle : ${PLAN_LABELS[currentPlan]}) et je souhaite passer à la formule ${PLAN_LABELS[plan]}.`,
        ),
        "_blank",
      );
    } catch {
      toast.error(t("common.error"));
    } finally {
      setRequestingPlan(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("plan.title")}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {trialDaysLeft != null && (
          <div
            className={cn(
              "mb-4 rounded-xl border p-4",
              trialDaysLeft <= TRIAL_REMINDER_DAYS
                ? "border-amber-300 bg-amber-50"
                : "border-primary-200 bg-primary-50/60",
            )}
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-accent-500" />
              {trialDaysLeft > 0
                ? t("plan.trialRemaining").replace("{days}", String(trialDaysLeft))
                : trialDaysLeft === 0
                  ? t("plan.trialLastDay")
                  : t("plan.trialOver")}
            </p>
            <p className="mt-1 text-sm text-foreground/70">
              {trialDaysLeft >= 0 ? t("plan.trialHint") : t("plan.trialOverHint")}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan === currentPlan;
            const price = PLAN_PRICE[plan];
            const estimate =
              price.amountPerStudent != null
                ? formatMRU(price.amountPerStudent * studentCount)
                : null;

            return (
              <div
                key={plan}
                className={cn(
                  "flex flex-col rounded-xl border p-4",
                  isCurrent
                    ? "border-primary-500 bg-primary-50/50 ring-1 ring-primary-500"
                    : "border-border",
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">
                    {tk(PLAN_LABEL_KEYS[plan])}
                  </h3>
                  {isCurrent && (
                    <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[11px] font-medium text-white">
                      {t("plan.current")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-foreground/60">
                  {price.amountPerStudent != null
                    ? `${price.amountPerStudent} ${t("plan.perStudentMonth")}`
                    : t("plan.onQuote")}
                </p>
                {estimate && (
                  <p className="text-xs text-foreground/40">
                    {t("plan.estimate")
                      .replace("{amount}", estimate)
                      .replace("{count}", String(studentCount))}
                  </p>
                )}

                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {plan === "standard" ? (
                    STANDARD_FEATURE_KEYS.map((key) => (
                      <li key={key} className="flex items-start gap-2 text-foreground/70">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />
                        {tk(key)}
                      </li>
                    ))
                  ) : (
                    <>
                      <li className="text-xs font-medium uppercase tracking-wide text-foreground/40">{t("plan.allStandardPlus")}</li>
                      {PLAN_FEATURE_LIST[plan].map((f) => (
                        <li key={f.feature} className="flex items-start gap-2 text-foreground/70">
                          {IS_FEATURE_LIVE[f.feature] ? (
                            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-500" />
                          ) : (
                            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/25" />
                          )}
                          <span className={cn(!IS_FEATURE_LIVE[f.feature] && "text-foreground/40")}>
                            {tk(FEATURE_LABEL_KEYS[f.feature])}
                            {!IS_FEATURE_LIVE[f.feature] && ` ${t("plan.comingSoon")}`}
                          </span>
                        </li>
                      ))}
                    </>
                  )}
                </ul>

                {!isCurrent && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    disabled={requestingPlan === plan}
                    onClick={() => handleRequest(plan)}
                  >
                    {requestingPlan === plan ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : requested === plan ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <MessageCircle className="h-3.5 w-3.5" />
                    )}
                    {requested === plan ? t("plan.requested") : t("plan.request")}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-foreground/40">{t("plan.manualNote")}</p>
      </CardContent>
    </Card>
  );
}
