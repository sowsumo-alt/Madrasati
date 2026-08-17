/**
 * Structure scolaire mauritanienne de référence — ce qui permet à une école
 * d'avoir ses classes dès la première connexion, sans que le directeur ait à
 * les saisir une par une.
 *
 * La nomenclature est celle utilisée en Mauritanie : Année Fondamentale (AF)
 * pour le fondamental, Année Secondaire (AS) ensuite, jusqu'à la 5AS qui est
 * l'année du baccalauréat. Le découpage français (CI, CP, CM2, 6ème,
 * Terminale) n'a pas cours ici et ne doit pas réapparaître.
 */

export const CYCLES = ["primaire", "college", "lycee"] as const;
export type Cycle = (typeof CYCLES)[number];

const LEVELS_BY_CYCLE: Record<Cycle, string[]> = {
  primaire: ["1AF", "2AF", "3AF", "4AF", "5AF", "6AF"],
  college: ["1AS", "2AS", "3AS", "4AS"],
  lycee: ["5AS"],
};

export const SCHOOL_TYPES = ["primaire", "college_lycee", "complet"] as const;
export type SchoolType = (typeof SCHOOL_TYPES)[number];

export function isSchoolType(value: string): value is SchoolType {
  return (SCHOOL_TYPES as readonly string[]).includes(value);
}

const CYCLES_BY_SCHOOL_TYPE: Record<SchoolType, Cycle[]> = {
  primaire: ["primaire"],
  college_lycee: ["college", "lycee"],
  complet: ["primaire", "college", "lycee"],
};

export const SCHOOL_TYPE_LABELS: Record<SchoolType, string> = {
  primaire: "Fondamental",
  college_lycee: "Collège / Lycée",
  complet: "Les deux",
};

export const SCHOOL_TYPE_HINTS: Record<SchoolType, string> = {
  primaire: "1AF à 6AF",
  college_lycee: "1AS à 5AS",
  complet: "1AF à 5AS",
};

/**
 * Matières par cycle : au fondamental on n'enseigne ni la physique-chimie ni
 * les SVT, les rattacher automatiquement encombrerait les bulletins de
 * colonnes vides. Les noms correspondent à MAURITANIAN_SUBJECTS
 * (src/lib/school-setup.ts), créées en même temps que l'école.
 */
const SUBJECTS_BY_CYCLE: Record<Cycle, string[]> = {
  primaire: [
    "Mathématiques",
    "Français",
    "Arabe",
    "Études Islamiques",
    "Histoire-Géographie",
    "Éducation Physique",
  ],
  college: [
    "Mathématiques",
    "Français",
    "Arabe",
    "Études Islamiques",
    "Physique-Chimie",
    "Sciences de la Vie et de la Terre",
    "Histoire-Géographie",
    "Anglais",
    "Informatique",
    "Éducation Physique",
  ],
  lycee: [
    "Mathématiques",
    "Français",
    "Arabe",
    "Études Islamiques",
    "Physique-Chimie",
    "Sciences de la Vie et de la Terre",
    "Histoire-Géographie",
    "Anglais",
    "Informatique",
    "Éducation Physique",
  ],
};

export interface StandardClass {
  name: string;
  level: string;
  cycle: Cycle;
}

/**
 * Classes livrées avec une école de ce type, une par niveau. La classe porte
 * simplement le nom du niveau (« 6AF ») ; un directeur qui a plusieurs
 * sections d'un même niveau les nomme lui-même (« 6AF A », « 6AF B »).
 */
export function standardClassesFor(type: SchoolType): StandardClass[] {
  return CYCLES_BY_SCHOOL_TYPE[type].flatMap((cycle) =>
    LEVELS_BY_CYCLE[cycle].map((level) => ({
      name: level,
      level,
      cycle,
    })),
  );
}

export function subjectNamesForCycle(cycle: Cycle): string[] {
  return SUBJECTS_BY_CYCLE[cycle];
}

/** Résumé affiché avant création, ex. « 11 classes, de 1AF à 5AS ». */
export function describeSchoolType(type: SchoolType): string {
  const classes = standardClassesFor(type);
  return `${classes.length} classes, de ${classes[0].level} à ${classes[classes.length - 1].level}`;
}
