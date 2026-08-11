export interface SubjectResult {
  subjectName: string;
  /** Nom arabe, imprimé à droite du nom français. Null si non renseigné. */
  subjectNameAr: string | null;
  coefficient: number;
  /** Moyenne de l'élève dans la matière, ramenée sur 20. Null si aucune note. */
  average: number | null;
  /** Moyenne de la classe dans la matière, sur 20. Null si aucune note. */
  classAverage: number | null;
  examCount: number;
}

/**
 * Moyenne générale pondérée : somme(moyenne × coefficient) / somme(coefficients),
 * en ignorant les matières sans aucune note.
 */
export function weightedAverage(results: SubjectResult[]): number | null {
  const scored = results.filter((r) => r.average != null);
  if (scored.length === 0) return null;

  const totalCoefficient = scored.reduce((sum, r) => sum + r.coefficient, 0);
  if (totalCoefficient === 0) return null;

  const weightedSum = scored.reduce((sum, r) => sum + (r.average as number) * r.coefficient, 0);
  return weightedSum / totalCoefficient;
}

export type MentionKey =
  | "NONE"
  | "EXCELLENT"
  | "VERY_GOOD"
  | "GOOD"
  | "FAIRLY_GOOD"
  | "PASSABLE"
  | "INSUFFICIENT";

/**
 * Mention scolaire à partir d'une moyenne sur 20.
 *
 * Renvoie un code stable plutôt qu'un texte : le mot affiché dépend de la
 * langue de l'utilisateur (fr/en/ar) et se traduit à l'affichage via le
 * dictionnaire, pas ici.
 */
export function mentionFor(average: number | null): MentionKey {
  if (average == null) return "NONE";
  if (average >= 16) return "EXCELLENT";
  if (average >= 14) return "VERY_GOOD";
  if (average >= 12) return "GOOD";
  if (average >= 10) return "FAIRLY_GOOD";
  if (average >= 8) return "PASSABLE";
  return "INSUFFICIENT";
}

/** Libellés français fixes, réservés au prompt envoyé à l'IA (toujours en
 *  français quelle que soit la langue de l'interface — voir lib/ai.ts). */
export const MENTION_LABELS_FR: Record<MentionKey, string> = {
  NONE: "—",
  EXCELLENT: "Excellent",
  VERY_GOOD: "Très bien",
  GOOD: "Bien",
  FAIRLY_GOOD: "Assez bien",
  PASSABLE: "Passable",
  INSUFFICIENT: "Insuffisant",
};

/** Classement d'un élève parmi les moyennes de sa classe (1 = premier). */
export function rankOf(studentAverage: number | null, allAverages: number[]): number | null {
  if (studentAverage == null) return null;
  const better = allAverages.filter((a) => a > studentAverage).length;
  return better + 1;
}
