import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyMultiRule,
  computeSubjectAverage,
  defaultGradingConfig,
  describeFormula,
  divisorOf,
  gradingConfigSchema,
  parseGradingConfig,
  partForKind,
  type Formula,
  type MultiRule,
} from "../src/lib/grading-config";

const LABELS: Record<MultiRule, string> = {
  BEST: "la meilleure note",
  AVERAGE: "la moyenne",
  SUM: "la somme",
  LAST: "la dernière note",
};

test("le modèle par défaut est celui de l'École Ngalam", () => {
  const { secondary, fundamental } = defaultGradingConfig();
  assert.equal(secondary.parts.length, 2);
  assert.equal(secondary.parts[0].multiple, "BEST");
  assert.equal(secondary.parts[0].weight, 3);
  assert.equal(secondary.parts[1].weight, 1);
  assert.equal(divisorOf(secondary), 4);
  assert.equal(
    describeFormula(secondary, LABELS),
    "(la meilleure note devoirs × 3 + la dernière note composition) ÷ 4",
  );
  // Le Fondamental garde la moyenne simple de toutes ses notes.
  assert.equal(fundamental.parts.length, 1);
  assert.equal(fundamental.parts[0].multiple, "AVERAGE");
  assert.equal(divisorOf(fundamental), 1);
});

test("chaque règle de répétition donne ce qu'elle annonce", () => {
  assert.deepEqual(applyMultiRule([12, 14, 9], "BEST"), { value: 14, index: 1 });
  assert.deepEqual(applyMultiRule([12, 14], "LAST"), { value: 14, index: 1 });
  assert.deepEqual(applyMultiRule([12, 14], "AVERAGE"), { value: 13, index: null });
  assert.deepEqual(applyMultiRule([12, 14], "SUM"), { value: 26, index: null });
  assert.equal(applyMultiRule([], "BEST"), null);
});

test("la moyenne d'une matière suit la formule donnée", () => {
  const { secondary } = defaultGradingConfig();
  const computed = computeSubjectAverage(secondary, [[12, 14], [13]]);
  assert.equal(computed.divisor, 4);
  assert.equal(computed.parts[0].usedIndex, 1);
  assert.equal(computed.parts[0].weighted, 42);
  assert.equal(computed.average, 13.75);
});

test("la note retenue est repérée même si une note manque au milieu", () => {
  const { secondary } = defaultGradingConfig();
  const computed = computeSubjectAverage(secondary, [[null, 14, 9], [13]]);
  assert.equal(computed.parts[0].usedIndex, 1); // le 14, deuxième colonne
  assert.equal(computed.average, 13.75);
});

test("une école peut faire la moyenne de ses devoirs, sans composition", () => {
  const formula: Formula = {
    parts: [
      { id: "devoir", label: "Devoirs", kinds: ["DEVOIR"], weight: 1, multiple: "AVERAGE", required: true },
    ],
    divisor: { mode: "AUTO" },
  };
  assert.equal(computeSubjectAverage(formula, [[12, 14]]).average, 13);
  assert.equal(describeFormula(formula, LABELS), "(la moyenne devoirs) ÷ 1");
});

test("une école peut imposer son diviseur, par exemple 9 pour un bulletin annuel", () => {
  const formula: Formula = {
    parts: [
      { id: "c1", label: "Composition 1", kinds: ["COMPOSITION"], weight: 3, multiple: "AVERAGE", required: true },
    ],
    divisor: { mode: "FIXED", value: 9 },
  };
  assert.equal(divisorOf(formula), 9);
  assert.equal(computeSubjectAverage(formula, [[12]]).average, 4); // 36 ÷ 9
});

test("un bloc obligatoire sans note laisse la matière sans moyenne", () => {
  const { secondary } = defaultGradingConfig();
  assert.equal(computeSubjectAverage(secondary, [[12, 14], []]).average, null);
  assert.equal(computeSubjectAverage(secondary, [[], [13]]).average, null);
});

test("un examen rejoint le bloc qui accepte son type, sinon le bloc attrape-tout", () => {
  const { secondary, fundamental } = defaultGradingConfig();
  assert.equal(partForKind(secondary, "DEVOIR")?.id, "devoir");
  assert.equal(partForKind(secondary, "CONTROLE")?.id, "devoir");
  assert.equal(partForKind(secondary, "COMPOSITION")?.id, "composition");
  // Le Fondamental n'a qu'un bloc, sans type coché : il prend tout.
  assert.equal(partForKind(fundamental, "COMPOSITION")?.id, "toutes");
});

test("modèle annuel par défaut : meilleur devoir × 3 + compositions × 1, × 2, × 3, ÷ 9", () => {
  const { annual } = defaultGradingConfig();
  assert.equal(annual.enabled, true);
  assert.equal(annual.passThreshold, 10);
  assert.deepEqual(
    annual.secondary.parts.map((p) => [p.weight, p.term ?? "année"]),
    [
      [3, "année"],
      [1, "Trimestre 1"],
      [2, "Trimestre 2"],
      [3, "Trimestre 3"],
    ],
  );
  assert.equal(divisorOf(annual.secondary), 9);
});

test("au bulletin annuel, une composition rejoint le bloc de son trimestre", () => {
  const { annual } = defaultGradingConfig();
  assert.equal(partForKind(annual.secondary, "COMPOSITION", "Trimestre 2")?.id, "composition-t2");
  assert.equal(partForKind(annual.secondary, "DEVOIR", "Trimestre 3")?.id, "devoir");
});

test("une règle enregistrée avec l'ancien format annuel est relue sans rien perdre d'autre", () => {
  const old = defaultGradingConfig() as unknown as Record<string, unknown>;
  const secondary = { ...defaultGradingConfig().secondary, divisor: { mode: "FIXED", value: 5 } };
  const parsed = parseGradingConfig({
    ...old,
    secondary,
    annual: { enabled: false, terms: [{ term: "Trimestre 1", weight: 1 }], divisor: { mode: "AUTO" } },
  });
  assert.deepEqual(parsed.secondary.divisor, { mode: "FIXED", value: 5 });
  assert.equal(parsed.annual.enabled, false);
  assert.equal(divisorOf(parsed.annual.secondary), 9);
});

test("une configuration abîmée ne bloque rien : on repart du modèle par défaut", () => {
  assert.deepEqual(parseGradingConfig({ version: 9, hello: true }), defaultGradingConfig());
  assert.deepEqual(parseGradingConfig(null), defaultGradingConfig());
  // Une configuration valide est relue telle quelle.
  const config = defaultGradingConfig();
  config.secondary.parts[0].weight = 2;
  assert.deepEqual(parseGradingConfig(config), config);
});

test("une règle sans aucun type de note est refusée", () => {
  const config = defaultGradingConfig();
  config.secondary.parts = [];
  assert.equal(gradingConfigSchema.safeParse(config).success, false);
});
