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

/** Mention scolaire à partir d'une moyenne sur 20. */
export function mentionFor(average: number | null): string {
  if (average == null) return "—";
  if (average >= 16) return "Excellent";
  if (average >= 14) return "Très bien";
  if (average >= 12) return "Bien";
  if (average >= 10) return "Assez bien";
  if (average >= 8) return "Passable";
  return "Insuffisant";
}

/** Classement d'un élève parmi les moyennes de sa classe (1 = premier). */
export function rankOf(studentAverage: number | null, allAverages: number[]): number | null {
  if (studentAverage == null) return null;
  const better = allAverages.filter((a) => a > studentAverage).length;
  return better + 1;
}
