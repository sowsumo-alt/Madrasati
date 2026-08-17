/**
 * Structure scolaire mauritanienne de référence — ce qui permet à une école
 * d'avoir ses classes dès la première connexion, sans que le directeur ait à
 * les saisir une par une.
 *
 * Les noms suivent la nomenclature en usage dans les établissements privés
 * mauritaniens (CI…CM2 au fondamental, puis 6ème…Terminale), la même que
 * l'école de démonstration.
 */

export const CYCLES = ["primaire", "college", "lycee"] as const;
export type Cycle = (typeof CYCLES)[number];

const LEVELS_BY_CYCLE: Record<Cycle, string[]> = {
  primaire: ["CI", "CP", "CE1", "CE2", "CM1", "CM2"],
  college: ["6ème", "5ème", "4ème", "3ème"],
  lycee: ["2nde", "1ère", "Terminale"],
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
  primaire: "École primaire",
  college_lycee: "Collège / Lycée",
  complet: "Les deux",
};

export const SCHOOL_TYPE_HINTS: Record<SchoolType, string> = {
  primaire: "CI à CM2",
  college_lycee: "6ème à Terminale",
  complet: "CI à Terminale",
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
 * Classes livrées avec une école de ce type, une par niveau. Le suffixe « A »
 * laisse la place à une deuxième section (« 6ème B ») que le directeur ajoute
 * lui-même s'il en a besoin.
 */
export function standardClassesFor(type: SchoolType): StandardClass[] {
  return CYCLES_BY_SCHOOL_TYPE[type].flatMap((cycle) =>
    LEVELS_BY_CYCLE[cycle].map((level) => ({
      name: `${level} A`,
      level,
      cycle,
    })),
  );
}

export function subjectNamesForCycle(cycle: Cycle): string[] {
  return SUBJECTS_BY_CYCLE[cycle];
}

/** Résumé affiché avant création, ex. « 13 classes, de CI à Terminale ». */
export function describeSchoolType(type: SchoolType): string {
  const classes = standardClassesFor(type);
  return `${classes.length} classes, de ${classes[0].level} à ${classes[classes.length - 1].level}`;
}
