/**
 * Liste des classes du directeur : recherche, filtre par cycle, couleur de
 * chaque classe et chiffres d'en-tête. Sans dépendance à React, pour être
 * testée à part.
 */

export const CLASS_FILTERS = ["ALL", "AF", "AS", "INCOMPLETE"] as const;
export type ClassFilter = (typeof CLASS_FILTERS)[number];

export function isClassFilter(value: string): value is ClassFilter {
  return (CLASS_FILTERS as readonly string[]).includes(value);
}

export interface ClassListItem {
  name: string;
  level: string;
  mainTeacher: { firstName: string; lastName: string } | null;
  assignments: { subjectId: string }[];
}

/** Cycle d'une classe d'après son niveau mauritanien (1AF…6AF, 1AS…5AS) ;
 *  null pour une classe nommée autrement, qui n'apparaît alors que dans
 *  « Toutes les classes ». */
export function classCycle(level: string): "AF" | "AS" | null {
  const compact = level.replace(/\s/g, "").toUpperCase();
  if (compact.endsWith("AF")) return "AF";
  if (compact.endsWith("AS")) return "AS";
  return null;
}

/**
 * Ce qui manque pour qu'une classe soit prête : sans matière, elle ne peut
 * recevoir ni note, ni examen, ni bulletin ; sans professeur principal,
 * personne n'en est responsable.
 */
export function missingSetup(c: ClassListItem): ("subjects" | "mainTeacher")[] {
  const missing: ("subjects" | "mainTeacher")[] = [];
  if (c.assignments.length === 0) missing.push("subjects");
  if (!c.mainTeacher) missing.push("mainTeacher");
  return missing;
}

const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function matchesClassFilters(c: ClassListItem, query: string, filter: ClassFilter): boolean {
  if (filter === "INCOMPLETE" && missingSetup(c).length === 0) return false;
  if ((filter === "AF" || filter === "AS") && classCycle(c.level) !== filter) return false;

  const q = normalize(query.trim());
  if (!q) return true;
  const teacher = c.mainTeacher ? `${c.mainTeacher.firstName} ${c.mainTeacher.lastName}` : "";
  return [c.name, c.level, teacher].some((field) => normalize(field).includes(q));
}

/** Quatre teintes en alternance : deux classes voisines ne se confondent
 *  jamais, et une classe garde sa couleur tant que la liste ne change pas. */
export const CLASS_TONES = ["green", "blue", "amber", "violet"] as const;
export type ClassTone = (typeof CLASS_TONES)[number];

export function classTone(index: number): ClassTone {
  return CLASS_TONES[((index % CLASS_TONES.length) + CLASS_TONES.length) % CLASS_TONES.length];
}

/** Nombre d'enseignants différents désignés professeur principal : une même
 *  personne responsable de deux classes ne compte qu'une fois. */
export function mainTeacherCount(classes: { mainTeacher: { id: string } | null }[]): number {
  return new Set(classes.flatMap((c) => (c.mainTeacher ? [c.mainTeacher.id] : []))).size;
}
