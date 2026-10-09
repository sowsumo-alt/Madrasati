import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_MENTIONS, defaultGradingConfig, gradingConfigSchema, parseGradingConfig } from "../src/lib/grading-config";
import { bulletinFormula } from "../src/lib/report-card-compute";
import { mentionFor } from "../src/lib/report-card";

/**
 * Réglages propres à chaque école (décision du 9 oct. 2026) : la formule du
 * 2e trimestre et le barème des mentions. Par défaut, le comportement d'avant
 * est conservé à l'identique.
 */

test("par défaut : 2e trimestre cumulatif et barème des mentions d'avant", () => {
  const config = defaultGradingConfig();
  assert.equal(config.annual.secondTerm, "CUMULATIVE");
  assert.deepEqual(config.mentions, { excellent: 16, veryGood: 14, good: 12, fairlyGood: 10, passable: 8 });
  // T2 cumulatif : composition T1 (× 1) et T2 (× 2) à côté du meilleur devoir (× 3).
  const { formula } = bulletinFormula(config, "COLLEGE", "Trimestre 2");
  assert.deepEqual(formula.parts.map((p) => [p.term, p.weight]), [["Trimestre 2", 3], ["Trimestre 1", 1], ["Trimestre 2", 2]]);
  assert.equal(mentionFor(14), "VERY_GOOD");
  assert.equal(mentionFor(8), "PASSABLE");
});

test("une école qui choisit « trimestre seul » : (meilleur devoir × 3 + composition) ÷ 4", () => {
  const config = defaultGradingConfig();
  config.annual.secondTerm = "TERM";
  const { formula, yearScope } = bulletinFormula(config, "COLLEGE", "Trimestre 2");
  assert.equal(yearScope, false);
  assert.deepEqual(formula, config.secondary);
  // Le 3e trimestre reste le bulletin annuel.
  assert.equal(bulletinFormula(config, "COLLEGE", "Trimestre 3").yearScope, true);
});

test("barème des mentions propre à l'école", () => {
  const scale = { excellent: 18, veryGood: 16, good: 14, fairlyGood: 12, passable: 10 };
  assert.equal(mentionFor(14, scale), "GOOD");
  assert.equal(mentionFor(10, scale), "PASSABLE");
  assert.equal(mentionFor(9.99, scale), "INSUFFICIENT");
  assert.equal(mentionFor(null, scale), "NONE");
});

test("une règle enregistrée avant ces réglages garde le comportement d'avant", () => {
  const stored = JSON.parse(JSON.stringify(defaultGradingConfig()));
  delete stored.mentions;
  delete stored.annual.secondTerm;
  const config = parseGradingConfig(stored);
  assert.equal(config.annual.secondTerm, "CUMULATIVE");
  assert.deepEqual(config.mentions, DEFAULT_MENTIONS);
});

test("un barème dans le désordre est refusé", () => {
  const config = { ...defaultGradingConfig(), mentions: { excellent: 12, veryGood: 14, good: 12, fairlyGood: 10, passable: 8 } };
  assert.equal(gradingConfigSchema.safeParse(config).success, false);
});
