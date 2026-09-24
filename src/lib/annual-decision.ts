/**
 * Fin d'année : les mentions du conseil des professeurs et la décision de
 * passage, telles qu'elles figurent sur le bulletin annuel officiel.
 *
 * Madrasati suggère une décision d'après la moyenne annuelle et le seuil de
 * l'école ; il ne la prend jamais. Tant que le directeur n'a rien validé,
 * rien n'est coché sur le bulletin.
 *
 * Sans dépendance à la base ni à React : testé à part
 * (tests/annual-decision.test.ts).
 */

export const HONORS = [
  { key: "FELICITATIONS", fr: "Félicitations", ar: "تهنئة" },
  { key: "ENCOURAGEMENTS", fr: "Encouragements", ar: "تشجيع" },
  { key: "TABLEAU_HONNEUR", fr: "Tableau d'honneur", ar: "لوحة الشرف" },
  { key: "AVERTISSEMENT", fr: "Avertissement", ar: "إنذار" },
] as const;
export type HonorKey = (typeof HONORS)[number]["key"];

export const DECISIONS = [
  { key: "PROMOTED", fr: "Passe en classe supérieure", ar: "ينتقل إلى القسم الأعلى" },
  { key: "ALLOWED", fr: "Autorisé(e)", ar: "مرخَّص له (لها)" },
  { key: "REPEAT", fr: "À redoubler", ar: "يعيد السنة" },
] as const;
export type DecisionKey = (typeof DECISIONS)[number]["key"];

export function isHonorKey(value: unknown): value is HonorKey {
  return HONORS.some((h) => h.key === value);
}

export function isDecisionKey(value: unknown): value is DecisionKey {
  return DECISIONS.some((d) => d.key === value);
}

/** Mentions enregistrées, relues sans faire confiance à leur format. */
export function parseHonors(value: unknown): HonorKey[] {
  return Array.isArray(value) ? value.filter(isHonorKey) : [];
}

/**
 * Décision suggérée : le passage à partir du seuil de l'école (10/20 par
 * défaut), le redoublement en dessous. Rien sans moyenne annuelle.
 * « Autorisé(e) » n'est jamais suggéré : c'est un choix du conseil.
 */
export function suggestDecision(average: number | null, threshold: number): DecisionKey | null {
  if (average == null) return null;
  return average >= threshold ? "PROMOTED" : "REPEAT";
}

export function decisionLabel(key: string | null | undefined): { fr: string; ar: string } | null {
  return DECISIONS.find((d) => d.key === key) ?? null;
}
