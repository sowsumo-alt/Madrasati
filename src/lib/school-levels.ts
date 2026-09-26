/**
 * Structure scolaire mauritanienne de référence — ce qui permet à une école
 * d'avoir ses classes dès la première connexion, sans que le directeur ait à
 * les saisir une par une.
 *
 * La nomenclature est celle utilisée en Mauritanie : Année Fondamentale (AF)
 * pour le fondamental, Année Secondaire (AS) au collège, puis au lycée la 4D
 * et les séries SN et A de la 5e à la 7e année. Les niveaux viennent du
 * catalogue des classes (src/lib/class-catalog.ts). Le découpage français
 * (CI, CP, CM2, 6ème, Terminale) n'a pas cours ici et ne doit pas réapparaître.
 */

import { STANDARD_LEVELS, type StandardCategory } from "@/lib/class-catalog";

export const CYCLES = ["primaire", "college", "lycee"] as const;
export type Cycle = (typeof CYCLES)[number];

/** Catégorie de classe correspondant à chaque cycle. */
export const CATEGORY_BY_CYCLE: Record<Cycle, StandardCategory> = {
  primaire: "FONDAMENTAL",
  college: "COLLEGE",
  lycee: "LYCEE",
};

const LEVELS_BY_CYCLE: Record<Cycle, string[]> = {
  primaire: STANDARD_LEVELS.FONDAMENTAL,
  college: STANDARD_LEVELS.COLLEGE,
  lycee: STANDARD_LEVELS.LYCEE,
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
  college_lycee: "1AS à 7SN / 7A",
  complet: "1AF à 7SN / 7A",
};

/**
 * Matières par cycle : au fondamental on n'enseigne ni la physique-chimie ni
 * les SVT, les rattacher automatiquement encombrerait les bulletins de
 * colonnes vides. Les noms correspondent à MAURITANIAN_SUBJECTS
 * (src/lib/school-setup.ts), créées en même temps que l'école.
 *
 * Au collège et au lycée : les neuf matières du bulletin officiel (voir
 * SECONDARY_OFFICIAL_SUBJECTS dans src/lib/grading.ts), avec ses
 * coefficients — total 24. La physique-chimie et l'informatique restent dans
 * la liste des matières de l'école, à rattacher aux classes qui les ont.
 */
const SECONDARY_SUBJECTS = [
  "Arabe",
  "Français",
  "Anglais",
  "Mathématiques",
  "Sciences de la Vie et de la Terre",
  "Histoire-Géographie",
  "Études Islamiques",
  "Instruction Civique",
  "Éducation Physique",
];

const SUBJECTS_BY_CYCLE: Record<Cycle, string[]> = {
  primaire: [
    "Mathématiques",
    "Français",
    "Arabe",
    "Études Islamiques",
    "Histoire-Géographie",
    "Éducation Physique",
  ],
  college: SECONDARY_SUBJECTS,
  lycee: SECONDARY_SUBJECTS,
};

export interface StandardClass {
  name: string;
  level: string;
  cycle: Cycle;
  category: StandardCategory;
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
      category: CATEGORY_BY_CYCLE[cycle],
    })),
  );
}

export function subjectNamesForCycle(cycle: Cycle): string[] {
  return SUBJECTS_BY_CYCLE[cycle];
}

/** Résumé affiché avant création, ex. « 16 classes, de 1AF à 7A ». */
export function describeSchoolType(type: SchoolType): string {
  const classes = standardClassesFor(type);
  return `${classes.length} classes, de ${classes[0].level} à ${classes[classes.length - 1].level}`;
}
