/**
 * Grille de saisie des notes du collège et du lycée : une colonne par devoir,
 * une colonne pour la composition (voir lib/grading.ts pour le calcul).
 * Sans dépendance à React ni à la base, pour être testée à part
 * (tests/grade-sheet.test.ts).
 */

export interface ParsedCell {
  score: number | null;
  isAbsent: boolean;
  /** Saisie illisible ou hors barème : bloque l'enregistrement. */
  invalid: boolean;
}

/** « abs », « a », « غ » (غائب) : l'élève était absent. */
const ABSENT = /^(abs?|absent|a|غ|غائب)$/i;

/**
 * Lit une case telle que tapée : « 12,5 » et « 12.5 » valent 12,5 ; une case
 * vide n'est pas une note.
 */
export function parseCell(raw: string, maxScore: number): ParsedCell {
  const value = raw.trim();
  if (value === "") return { score: null, isAbsent: false, invalid: false };
  if (ABSENT.test(value)) return { score: null, isAbsent: true, invalid: false };

  const normalized = value.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return { score: null, isAbsent: false, invalid: true };
  const score = Number(normalized);
  if (score < 0 || score > maxScore) return { score, isAbsent: false, invalid: true };
  return { score, isAbsent: false, invalid: false };
}

/** Texte d'une note enregistrée, prête à être modifiée : « 12,5 », « abs » ou vide. */
export function formatCell(grade: { score: number | null; isAbsent: boolean } | undefined): string {
  if (!grade) return "";
  if (grade.isAbsent) return "abs";
  return grade.score == null ? "" : String(grade.score).replace(".", ",");
}

/** Clé d'une case de la grille. */
export function cellKey(column: string, studentId: string): string {
  return `${column}:${studentId}`;
}

/**
 * Colonne ajoutée dans la grille mais pas encore enregistrée : « new:devoir:2 »
 * est la deuxième note ajoutée au bloc « devoir ». L'examen correspondant
 * n'est créé qu'à l'enregistrement, et seulement si une note y a été saisie.
 */
export const NEW_PREFIX = "new:";

export function newColumnKey(partId: string, index: number): string {
  return `${NEW_PREFIX}${partId}:${index}`;
}

export function isNewColumn(column: string): boolean {
  return column.startsWith(NEW_PREFIX);
}

export function newColumnPart(column: string): string | null {
  if (!isNewColumn(column)) return null;
  return column.slice(NEW_PREFIX.length).split(":")[0] || null;
}
