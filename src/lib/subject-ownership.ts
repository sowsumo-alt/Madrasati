/**
 * À qui sont les notes d'une matière, dans une classe : à l'enseignant à qui
 * elle est confiée, et à lui seul. Le professeur principal ne garde que les
 * matières confiées à personne (au primaire, l'instituteur les enseigne
 * toutes) — il ne voit ni ne saisit jamais les notes d'un collègue.
 *
 * Règle unique pour la page Examens/Notes, la grille de saisie et le serveur
 * (lib/teacher-scope.ts, lib/grade-sheet-data.ts). Tests : tests/subject-ownership.test.ts.
 */
export function teachesSubject(
  teacherId: string,
  classSubject: { teacherId: string | null } | null | undefined,
  mainTeacherId: string | null,
): boolean {
  if (!teacherId) return false;
  if (classSubject?.teacherId) return classSubject.teacherId === teacherId;
  return mainTeacherId === teacherId;
}
