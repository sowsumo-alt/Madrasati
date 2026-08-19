/**
 * Périmètre « année scolaire en cours ».
 *
 * Ouvrir une nouvelle année scolaire recopie les classes de l'année passée
 * (voir createNextAcademicYear) : l'école possède alors deux jeux de classes
 * portant exactement les mêmes noms. Toute liste qui interroge les classes
 * sur le seul schoolId affiche donc « 1AF, 1AF, 1AS, 1AS… » sans que rien ne
 * distingue les deux, et le directeur ne peut plus savoir laquelle choisir.
 * Pire, la classe de l'année écoulée garde ses élèves tant que la
 * réinscription n'a pas eu lieu, si bien qu'un enseignant tombait sur la
 * classe vide de la nouvelle année et lisait « aucun élève ».
 *
 * Toutes les listes de sélection (classes, appel, examens, emploi du temps,
 * bulletins, import) doivent donc se limiter à l'année en cours. Les
 * contrôles d'autorisation, eux, restent volontairement sur l'ensemble des
 * années : consulter un bulletin ou un reçu de l'an passé par lien direct
 * doit continuer de fonctionner.
 */
export const CURRENT_YEAR = { academicYear: { isCurrent: true } } as const;

/** Élèves actifs uniquement — la règle de comptage commune à tous les écrans. */
export const ACTIVE_STUDENTS_COUNT = {
  select: { students: { where: { status: "ACTIVE" } } },
} as const;
