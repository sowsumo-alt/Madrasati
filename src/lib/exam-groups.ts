/**
 * Regroupement des examens communs à plusieurs classes.
 *
 * Une composition trimestrielle est presque toujours passée le même jour par
 * plusieurs classes. Chaque classe a ses propres élèves — et parfois son
 * propre enseignant pour la matière — donc chaque classe garde son examen et
 * ses notes en base. Mais pour le directeur, c'est *un seul* examen : les
 * lister comme des lignes indépendantes lui fait perdre de vue qu'ils forment
 * un tout, et l'oblige à vérifier une par une lesquelles ont été notées.
 *
 * Le lien entre ces examens est déduit de leurs données plutôt que stocké
 * dans une colonne : aucune migration n'est nécessaire, et les examens déjà
 * saisis à la main, un par classe, se retrouvent regroupés rétroactivement
 * sans rien avoir à reprendre.
 */

export interface GroupableExam {
  title: string;
  /** Date ISO — seule la journée compte, pas l'heure. */
  date: string;
  subjectId: string;
}

/**
 * Clé d'un examen commun : même titre, même jour, **même matière**.
 *
 * La matière fait partie de la clé alors qu'on pourrait s'arrêter au titre et
 * à la date. C'est délibéré : le jour d'une composition générale, « Composition
 * Trimestre 1 » désigne l'épreuve de mathématiques en 1AF et celle de français
 * en 1AS. Les fondre dans un même bloc afficherait une progression de notes
 * qui ne veut rien dire. Un examen créé pour plusieurs classes en une fois
 * porte toujours la même matière, donc ses classes restent bien réunies.
 *
 * Le titre est comparé sans casse ni espaces superflus, pour que
 * « Composition Trimestre 1 » et « composition trimestre 1  » — deux saisies
 * du même directeur à deux moments — ne se retrouvent pas séparées.
 */
export function examGroupKey(exam: GroupableExam): string {
  const title = exam.title.trim().toLowerCase().replace(/\s+/g, " ");
  const day = exam.date.slice(0, 10);
  return `${title}|${day}|${exam.subjectId}`;
}

export interface ExamGroup<T extends GroupableExam> {
  key: string;
  /** Les examens du groupe, dans l'ordre où ils sont arrivés. */
  exams: T[];
  /** Vrai dès que l'examen est partagé par au moins deux classes. */
  isShared: boolean;
}

/**
 * Regroupe une liste d'examens déjà triée, en préservant son ordre : le
 * groupe apparaît à la place de son premier examen. Sans cela, réordonner les
 * groupes ferait sauter les examens dans la page à chaque saisie de note.
 */
export function groupExams<T extends GroupableExam>(exams: T[]): ExamGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const exam of exams) {
    const key = examGroupKey(exam);
    const bucket = groups.get(key);
    if (bucket) bucket.push(exam);
    else groups.set(key, [exam]);
  }

  return [...groups.entries()].map(([key, list]) => ({
    key,
    exams: list,
    isShared: list.length > 1,
  }));
}

/** Un examen est complet quand chaque élève de la classe a une note ou une absence. */
export function isFullyGraded(exam: { gradedCount: number; studentCount: number }) {
  // Le garde-fou sur studentCount évite d'annoncer « Complet » pour une classe
  // vide, où 0 note sur 0 élève satisferait la comparaison sans rien vouloir
  // dire — le directeur croirait la saisie faite.
  return exam.studentCount > 0 && exam.gradedCount >= exam.studentCount;
}
