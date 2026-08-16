"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMRU } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { CONTACT_PHONE } from "@/app/(marketing)/landing-config";
import {
  PLANS,
  PLAN_LABELS,
  PLAN_PRICE,
  PLAN_FEATURE_LIST,
  STANDARD_FEATURES,
  IS_FEATURE_LIVE,
  type Plan,
} from "@/lib/plans";
import { requestPlanUpgrade } from "./actions";

export function PlanCard({
  currentPlan,
  schoolName,
  studentCount,
}: {
  currentPlan: Plan;
  schoolName: string;
  studentCount: number;
}) {
  const [requestingPlan, setRequestingPlan] = useState<Plan | null>(null);
  const [requested, setRequested] = useState<Plan | null>(null);

  async function handleRequest(plan: Plan) {
    setRequestingPlan(plan);
    try {
      await requestPlanUpgrade(plan);
      setRequested(plan);
      toast.success("Demande enregistrée. Ouvrez WhatsApp pour finaliser avec nous.");
      window.open(
        buildWhatsAppUrl(
          CONTACT_PHONE,
          `Bonjour, je dirige l'école ${schoolName} sur Madrasati (formule actuelle : ${PLAN_LABELS[currentPlan]}) et je souhaite passer à la formule ${PLAN_LABELS[plan]}.`,
        ),
        "_blank",
      );
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setRequestingPlan(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Votre formule</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
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
                  <h3 className="font-semibold text-foreground">{PLAN_LABELS[plan]}</h3>
                  {isCurrent && (
                    <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[11px] font-medium text-white">
                      Formule actuelle
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-foreground/60">{price.label}</p>
                {estimate && (
                  <p className="text-xs text-foreground/40">
                    ≈ {estimate} / mois pour {studentCount} élève(s)
                  </p>
                )}

                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {plan === "standard" ? (
                    STANDARD_FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-foreground/70">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />
                        {f}
                      </li>
                    ))
                  ) : (
                    <>
                      <li className="text-xs font-medium uppercase tracking-wide text-foreground/40">
                        Tout Standard, plus :
                      </li>
                      {PLAN_FEATURE_LIST[plan].map((f) => (
                        <li key={f.feature} className="flex items-start gap-2 text-foreground/70">
                          {IS_FEATURE_LIVE[f.feature] ? (
                            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-500" />
                          ) : (
                            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/25" />
                          )}
                          <span className={cn(!IS_FEATURE_LIVE[f.feature] && "text-foreground/40")}>
                            {f.label}
                            {!IS_FEATURE_LIVE[f.feature] && " (bientôt disponible)"}
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
                    {requested === plan ? "Demande envoyée" : `Demander cette formule`}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-foreground/40">
          Le changement de formule n&apos;est jamais automatique : nous validons ensemble le
          paiement sur WhatsApp avant de l&apos;activer.
        </p>
      </CardContent>
    </Card>
  );
}
