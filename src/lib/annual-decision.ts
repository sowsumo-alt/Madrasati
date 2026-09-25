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
  { key: "FELICITATIONS", fr: "Félicitation", ar: "تهنئة" },
  { key: "ENCOURAGEMENTS", fr: "Encouragement", ar: "تشجيع" },
  { key: "TABLEAU_HONNEUR", fr: "Tableau d'honneur", ar: "لوحة شرف" },
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

/**
 * Classe de l'année suivante, pour dire « Passage en 2AS » plutôt que
 * « classe supérieure » : 1AF → 2AF, 6AF → 1AS, 1°AS → 2°AS, 5C → 6C.
 * Null quand on ne sait pas (dernière année, nom de classe libre).
 */
export function nextClassLabel(className: string): string | null {
  const levels = /(\d+)\s*([°º]?)\s*A\s*([FS])/i.exec(className);
  if (levels) {
    const n = Number(levels[1]);
    const degree = levels[2];
    const cycle = levels[3].toUpperCase();
    if (cycle === "F") return n < 6 ? `${n + 1}AF` : "1AS";
    return n < 5 ? `${n + 1}${degree}AS` : null;
  }
  const series = /(\d)\s*([°º]?)\s*(C|D|LM|LO|O)(?![a-z])/i.exec(className);
  if (series && Number(series[1]) < 7) {
    return `${Number(series[1]) + 1}${series[2]}${series[3].toUpperCase()}`;
  }
  return null;
}
