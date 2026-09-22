"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { EXAM_KINDS, type ExamKind } from "@/lib/exams";
import {
  computeSubjectAverage,
  defaultGradingConfig,
  describeFormula,
  divisorOf,
  MULTI_RULES,
  type Formula,
  type FormulaPart,
  type GradingConfig,
  type MultiRule,
} from "@/lib/grading-config";
import { saveGradingRule } from "./actions";

/**
 * Réglage de la façon dont l'école calcule ses moyennes.
 *
 * Écrit pour un directeur, pas pour un informaticien : chaque ligne est un
 * type de note (« Devoirs », « Composition »), avec son poids et ce qu'on
 * fait quand il y en a plusieurs. Un exemple chiffré se recalcule à chaque
 * modification, pour qu'il voie tout de suite l'effet de son choix.
 *
 * Le réglage appartient à cette école seule : une autre école sur Madrasati
 * garde le sien.
 */

type Cycle = "secondary" | "fundamental";

/** Notes d'exemple, modifiables, pour montrer le calcul en direct. */
type SampleScores = Record<string, string>;

function sampleFor(formula: Formula): SampleScores {
  const sample: SampleScores = {};
  formula.parts.forEach((part, index) => {
    sample[part.id] = index === 0 ? "12, 14" : "13";
  });
  return sample;
}

function parseSample(value: string): number[] {
  return value
    .split(/[,;]/)
    .map((v) => Number(v.trim().replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 20);
}

function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100).replace(".", ",");
}

export function GradingRuleCard({
  initialConfig,
  isDefault,
  updatedAt,
}: {
  initialConfig: GradingConfig;
  /** Vrai tant que l'école n'a rien modifié : elle suit le modèle livré. */
  isDefault: boolean;
  updatedAt: string | null;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [config, setConfig] = useState<GradingConfig>(initialConfig);
  const [cycle, setCycle] = useState<Cycle>("secondary");
  const [sample, setSample] = useState<SampleScores>(() => sampleFor(initialConfig.secondary));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const formula = config[cycle];
  const ruleLabels = Object.fromEntries(
    MULTI_RULES.map((rule) => [rule, t(`grading.rule.${rule}` as TranslationKey)]),
  ) as Record<MultiRule, string>;

  function update(next: Formula) {
    setConfig((current) => ({ ...current, [cycle]: next }));
    setDirty(true);
  }

  function updatePart(index: number, patch: Partial<FormulaPart>) {
    // Les en-têtes du bulletin officiel (« Moy Int × 3 », « Compt ») ne valent
    // que pour le modèle d'origine : dès que l'école change le nom, le poids
    // ou la règle d'un bloc, la colonne prend simplement le nom du bloc.
    const renames =
      patch.label !== undefined || patch.weight !== undefined || patch.multiple !== undefined;
    update({
      ...formula,
      parts: formula.parts.map((p, i) =>
        i === index
          ? { ...p, ...patch, ...(renames ? { columnLabel: undefined, columnLabelAr: undefined } : {}) }
          : p,
      ),
    });
  }

  function addPart() {
    const id = `bloc${formula.parts.length + 1}-${Date.now().toString(36).slice(-4)}`;
    update({
      ...formula,
      parts: [
        ...formula.parts,
        {
          id,
          label: t("grading.newPart"),
          kinds: [],
          weight: 1,
          multiple: "AVERAGE",
          required: false,
        },
      ],
    });
    setSample((s) => ({ ...s, [id]: "12" }));
  }

  function removePart(index: number) {
    if (formula.parts.length === 1) return;
    update({ ...formula, parts: formula.parts.filter((_, i) => i !== index) });
  }

  function switchCycle(next: Cycle) {
    setCycle(next);
    setSample(sampleFor(config[next]));
  }

  function resetToDefault() {
    const fresh = defaultGradingConfig();
    setConfig((current) => ({ ...current, [cycle]: fresh[cycle] }));
    setSample(sampleFor(fresh[cycle]));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveGradingRule(config);
      toast.success(t("grading.saved"));
      setDirty(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  // L'exemple annuel : trois moyennes trimestrielles de démonstration.
  const ANNUAL_SAMPLE = [12, 14, 15];
  const annualWeights = config.annual.terms.map((x) => x.weight);
  const annualDivisor =
    config.annual.divisor.mode === "FIXED"
      ? config.annual.divisor.value
      : annualWeights.reduce((sum, w) => sum + w, 0);
  const annualValue =
    annualDivisor > 0
      ? ANNUAL_SAMPLE.reduce((sum, v, i) => sum + v * (annualWeights[i] ?? 0), 0) / annualDivisor
      : null;
  const annualText = config.annual.terms
    .map((x, i) => `${ANNUAL_SAMPLE[i]}${x.weight === 1 ? "" : ` × ${x.weight}`}`)
    .join(" + ");
  const annualExample = annualValue == null ? "—" : formatNumber(annualValue);
  const annualTotal = annualWeights.reduce((sum, w) => sum + w, 0);

  // L'exemple : les notes saisies plus haut, passées dans la formule en cours.
  const sampleScores = formula.parts.map((p) => parseSample(sample[p.id] ?? ""));
  const example = computeSubjectAverage(
    formula,
    sampleScores.map((list) => list as (number | null)[]),
  );

  return (
    <Card id="calcul" className="scroll-mt-24">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-sm">{t("grading.title")}</CardTitle>
        <div className="flex items-center gap-2">
          {isDefault && (
            <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
              {t("grading.usingDefault")}
            </span>
          )}
          {updatedAt && !isDefault && (
            <span className="text-xs text-foreground/50">
              {t("grading.updatedAt").replace("{date}", updatedAt)}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-4 pt-0">
        <p className="flex gap-2 rounded-xl bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-900/85">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          {t("grading.intro")}
        </p>

        {/* Cycle concerné : les deux ne comptent pas forcément pareil. */}
        <div className="flex flex-wrap gap-2">
          {(["secondary", "fundamental"] as Cycle[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => switchCycle(value)}
              data-testid={`cycle-${value}`}
              className={cn(
                "rounded-xl border px-4 py-2 text-sm font-semibold transition-colors",
                cycle === value
                  ? "border-primary-400 bg-primary-50 text-primary-800"
                  : "border-border bg-surface text-foreground/70 hover:bg-primary-50/40",
              )}
            >
              {t(`grading.cycle.${value}` as TranslationKey)}
            </button>
          ))}
        </div>

        {/* Les blocs de notes */}
        <div className="space-y-3">
          {formula.parts.map((part, index) => (
            <div
              key={part.id}
              className="rounded-xl border border-border bg-surface-muted/30 p-3"
              data-testid="formula-part"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`label-${part.id}`}>{t("grading.partName")}</Label>
                  <Input
                    id={`label-${part.id}`}
                    value={part.label}
                    onChange={(e) => updatePart(index, { label: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`weight-${part.id}`}>{t("grading.weight")}</Label>
                  <Input
                    id={`weight-${part.id}`}
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={part.weight}
                    onChange={(e) => updatePart(index, { weight: Number(e.target.value) || 0 })}
                    data-testid={`weight-${index}`}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>{t("grading.multiple")}</Label>
                  <Select
                    value={part.multiple}
                    onValueChange={(v) => updatePart(index, { multiple: v as MultiRule })}
                  >
                    <SelectTrigger aria-label={t("grading.multiple")} data-testid={`rule-${index}`}>
                      <SelectValue>{ruleLabels[part.multiple]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {MULTI_RULES.map((rule) => (
                        <SelectItem key={rule} value={rule}>
                          {ruleLabels[rule]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t("grading.kinds")}</Label>
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {EXAM_KINDS.map((kind) => {
                      const checked = part.kinds.includes(kind);
                      return (
                        <button
                          key={kind}
                          type="button"
                          onClick={() =>
                            updatePart(index, {
                              kinds: checked
                                ? part.kinds.filter((k) => k !== kind)
                                : ([...part.kinds, kind] as ExamKind[]),
                            })
                          }
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                            checked
                              ? "border-primary-400 bg-primary-100/70 text-primary-800"
                              : "border-border bg-surface text-foreground/60 hover:bg-primary-50/40",
                          )}
                        >
                          {t(`exams.kind.${kind}` as TranslationKey)}
                        </button>
                      );
                    })}
                  </div>
                  {part.kinds.length === 0 && (
                    <p className="text-xs text-foreground/50">{t("grading.allKinds")}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-foreground/70">
                  <input
                    type="checkbox"
                    checked={part.required}
                    onChange={(e) => updatePart(index, { required: e.target.checked })}
                    className="h-4 w-4 rounded border-border text-primary-700 focus:ring-primary-500"
                  />
                  {t("grading.required")}
                </label>
                {formula.parts.length > 1 && (
                  <Button variant="secondary" size="sm" onClick={() => removePart(index)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                    {t("grading.removePart")}
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Button variant="secondary" onClick={addPart} data-testid="add-part">
            <Plus className="h-4 w-4" />
            {t("grading.addPart")}
          </Button>
        </div>

        {/* Le diviseur */}
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface-muted/30 p-3">
          <div className="space-y-1.5">
            <Label>{t("grading.divisor")}</Label>
            <Select
              value={formula.divisor.mode}
              onValueChange={(mode) =>
                update({
                  ...formula,
                  divisor:
                    mode === "AUTO"
                      ? { mode: "AUTO" }
                      : { mode: "FIXED", value: divisorOf(formula) || 1 },
                })
              }
            >
              <SelectTrigger className="w-64" aria-label={t("grading.divisor")}>
                <SelectValue>
                  {formula.divisor.mode === "AUTO"
                    ? t("grading.divisorAuto").replace("{n}", String(divisorOf(formula)))
                    : t("grading.divisorFixed")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">
                  {t("grading.divisorAuto").replace(
                    "{n}",
                    String(formula.parts.reduce((s, p) => s + p.weight, 0)),
                  )}
                </SelectItem>
                <SelectItem value="FIXED">{t("grading.divisorFixed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formula.divisor.mode === "FIXED" && (
            <div className="space-y-1.5">
              <Label htmlFor="divisor-value">{t("grading.divisorValue")}</Label>
              <Input
                id="divisor-value"
                type="number"
                min={1}
                max={100}
                value={formula.divisor.value}
                onChange={(e) =>
                  update({
                    ...formula,
                    divisor: { mode: "FIXED", value: Number(e.target.value) || 1 },
                  })
                }
                className="w-28"
              />
            </div>
          )}
        </div>

        {/* L'exemple chiffré, recalculé à chaque modification */}
        <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-4">
          <p className="text-sm font-semibold text-primary-900">{t("grading.exampleTitle")}</p>
          <p className="mt-1 text-sm text-foreground/60">{t("grading.exampleHint")}</p>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {formula.parts.map((part, index) => (
              <div key={part.id} className="space-y-1.5">
                <Label htmlFor={`sample-${part.id}`}>{part.label}</Label>
                <Input
                  id={`sample-${part.id}`}
                  value={sample[part.id] ?? ""}
                  onChange={(e) => setSample((s) => ({ ...s, [part.id]: e.target.value }))}
                  placeholder="12, 14"
                  dir="ltr"
                  data-testid={`sample-${index}`}
                />
                <p className="text-xs text-foreground/50">
                  {ruleLabels[part.multiple]}
                  {part.weight !== 1 ? ` × ${part.weight}` : ""} ={" "}
                  {example.parts[index]?.weighted != null
                    ? formatNumber(example.parts[index].weighted as number)
                    : "—"}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-sm text-foreground/70" data-testid="formula-text">
            {describeFormula(formula, ruleLabels)}
          </p>
          <p className="mt-1 text-lg font-bold text-primary-800" data-testid="example-result">
            {t("grading.exampleResult").replace(
              "{value}",
              example.average != null ? example.average.toFixed(2).replace(".", ",") : "—",
            )}
          </p>
          {example.average == null && (
            <p className="mt-1 text-sm text-amber-700">{t("grading.exampleMissing")}</p>
          )}
        </div>

        {/* Bulletin annuel : les trimestres et leurs poids */}
        <div className="rounded-xl border border-border bg-surface-muted/30 p-3" data-testid="annual">
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <input
              type="checkbox"
              checked={config.annual.enabled}
              onChange={(e) => {
                setConfig((c) => ({ ...c, annual: { ...c.annual, enabled: e.target.checked } }));
                setDirty(true);
              }}
              className="h-4 w-4 rounded border-border text-primary-700 focus:ring-primary-500"
              data-testid="annual-enabled"
            />
            {t("grading.annualTitle")}
          </label>
          <p className="mt-1 text-sm text-foreground/60">{t("grading.annualHint")}</p>

          {config.annual.enabled && (
            <>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {config.annual.terms.map((term, index) => (
                  <div key={term.term} className="space-y-1.5">
                    <Label htmlFor={`term-${index}`}>{term.term}</Label>
                    <Input
                      id={`term-${index}`}
                      type="number"
                      min={0}
                      max={100}
                      value={term.weight}
                      onChange={(e) => {
                        const weight = Number(e.target.value) || 0;
                        setConfig((c) => ({
                          ...c,
                          annual: {
                            ...c.annual,
                            terms: c.annual.terms.map((x, i) => (i === index ? { ...x, weight } : x)),
                          },
                        }));
                        setDirty(true);
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label>{t("grading.annualDivisor")}</Label>
                  <Select
                    value={config.annual.divisor.mode}
                    onValueChange={(mode) => {
                      const total = config.annual.terms.reduce((sum, x) => sum + x.weight, 0) || 1;
                      setConfig((c) => ({
                        ...c,
                        annual: {
                          ...c.annual,
                          divisor:
                            mode === "AUTO" ? { mode: "AUTO" } : { mode: "FIXED", value: total },
                        },
                      }));
                      setDirty(true);
                    }}
                  >
                    <SelectTrigger className="w-64" aria-label={t("grading.annualDivisor")}>
                      <SelectValue>
                        {config.annual.divisor.mode === "AUTO"
                          ? t("grading.divisorAuto").replace("{n}", String(annualTotal))
                          : t("grading.divisorFixed")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUTO">
                        {t("grading.divisorAuto").replace("{n}", String(annualTotal))}
                      </SelectItem>
                      <SelectItem value="FIXED">{t("grading.divisorFixed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {config.annual.divisor.mode === "FIXED" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="annual-divisor">{t("grading.divisorValue")}</Label>
                    <Input
                      id="annual-divisor"
                      type="number"
                      min={1}
                      max={100}
                      value={config.annual.divisor.value}
                      onChange={(e) => {
                        const value = Number(e.target.value) || 1;
                        setConfig((c) => ({
                          ...c,
                          annual: { ...c.annual, divisor: { mode: "FIXED", value } },
                        }));
                        setDirty(true);
                      }}
                      className="w-28"
                    />
                  </div>
                )}
              </div>

              <p className="mt-3 text-sm text-foreground/70" data-testid="annual-example">
                {t("grading.annualExample")
                  .replace("{formula}", annualText)
                  .replace("{divisor}", String(annualDivisor))
                  .replace("{value}", annualExample)}
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" onClick={resetToDefault}>
            <RotateCcw className="h-4 w-4" />
            {t("grading.reset")}
          </Button>
          <Button onClick={handleSave} disabled={saving || !dirty} data-testid="save-rule">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("common.save")}
          </Button>
        </div>

        <p className="text-xs leading-relaxed text-foreground/55">{t("grading.footnote")}</p>
      </CardContent>
    </Card>
  );
}
