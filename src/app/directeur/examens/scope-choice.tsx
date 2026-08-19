"use client";

import { Check } from "lucide-react";
import { EXAM_SCOPES, type ExamScope } from "./schema";
import { useLanguage } from "@/lib/i18n/language-provider";

/**
 * « Cette classe seule » ou « toutes les classes de cet examen ».
 *
 * Le choix est posé explicitement, et par défaut sur la classe seule : une
 * suppression qui emporterait silencieusement les notes de six classes est
 * exactement le genre d'accident qu'on ne peut pas rattraper.
 */
export function ScopeChoice({
  value,
  onChange,
  classCount,
  className,
}: {
  value: ExamScope;
  onChange: (scope: ExamScope) => void;
  classCount: number;
  className: string;
}) {
  const { t } = useLanguage();

  const labels: Record<ExamScope, string> = {
    one: t("exams.scopeOne").replace("{class}", className),
    group: t("exams.scopeGroup").replace("{n}", String(classCount)),
  };

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground/80">{t("exams.applyTo")}</p>
      <div className="space-y-1.5 rounded-lg border border-border p-1.5">
        {EXAM_SCOPES.map((scope) => {
          const selected = value === scope;
          return (
            <button
              key={scope}
              type="button"
              onClick={() => onChange(scope)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-muted"
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  selected ? "border-primary-700 bg-primary-700 text-white" : "border-border"
                }`}
              >
                {selected && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
              </span>
              <span className={selected ? "text-foreground" : "text-foreground/70"}>
                {labels[scope]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
