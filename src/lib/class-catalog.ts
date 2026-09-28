import { schoolLevelOf } from "@/lib/grading";

/**
 * Catégories et niveaux des classes, selon le système éducatif mauritanien.
 *
 * Quatre catégories livrées avec Madrasati, chacune avec ses niveaux prêts à
 * choisir : le directeur ne tape pas « 1AF » à la main, donc jamais deux
 * orthographes pour un même niveau. Une école organisée autrement (une
 * Mahadra…) ajoute ses propres catégories et niveaux : ils sont gardés sur
 * ses classes et lui sont reproposés ensuite, sans rien imposer aux autres
 * écoles.
 *
 * Sans dépendance à la base ni à React, pour être testé à part.
 */

export const STANDARD_CATEGORIES = ["PRESCOLAIRE", "FONDAMENTAL", "COLLEGE", "LYCEE"] as const;
export type StandardCategory = (typeof STANDARD_CATEGORIES)[number];

export function isStandardCategory(value: string | null | undefined): value is StandardCategory {
  return (STANDARD_CATEGORIES as readonly string[]).includes(value ?? "");
}

export const CATEGORY_LABELS: Record<StandardCategory, string> = {
  PRESCOLAIRE: "Préscolaire",
  FONDAMENTAL: "Fondamental",
  COLLEGE: "Collège",
  LYCEE: "Lycée",
};

/**
 * Niveaux de chaque catégorie, dans l'ordre de la scolarité. Au lycée, la
 * 4D est une seule classe ; à partir de la 5e année, chaque année se divise
 * en deux séries : SN (sciences naturelles) et A (lettres).
 */
export const STANDARD_LEVELS: Record<StandardCategory, string[]> = {
  PRESCOLAIRE: ["Petite Section", "Moyenne Section", "Grande Section", "Jardin"],
  FONDAMENTAL: ["1AF", "2AF", "3AF", "4AF", "5AF", "6AF"],
  COLLEGE: ["1AS", "2AS", "3AS"],
  LYCEE: ["4D", "5SN", "5A", "6SN", "6A", "7SN", "7A"],
};

/** Libellé affiché d'une catégorie : le nom livré, ou celui de l'école. */
export function categoryLabel(category: string): string {
  return isStandardCategory(category) ? CATEGORY_LABELS[category] : category;
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\s.°º_-]+/g, "");

/** Niveau livré correspondant à un texte (« 1 AF », « jardin »), sinon null. */
export function findStandardLevel(
  text: string,
): { category: StandardCategory; level: string } | null {
  const wanted = normalize(text);
  if (!wanted) return null;
  for (const category of STANDARD_CATEGORIES) {
    const level = STANDARD_LEVELS[category].find((l) => normalize(l) === wanted);
    if (level) return { category, level };
  }
  return null;
}

const PRESCHOOL_WORDS = /\b(petite|moyenne|grande)\s+section\b|\bjardin\b|\bmaternelle\b|\bpr[ée]scolaire\b|^\s*[PMG]S\b/i;

/**
 * Catégorie d'une classe : celle enregistrée, sinon déduite de son niveau
 * puis de son nom (classes créées avant les catégories). Null quand rien ne
 * permet de la reconnaître.
 */
export function classCategory(c: {
  category?: string | null;
  level: string;
  name?: string;
}): string | null {
  if (c.category?.trim()) return c.category.trim();
  const standard = findStandardLevel(c.level) ?? findStandardLevel(c.name ?? "");
  if (standard) return standard.category;
  if (PRESCHOOL_WORDS.test(c.level) || PRESCHOOL_WORDS.test(c.name ?? "")) return "PRESCOLAIRE";
  const school = schoolLevelOf(c.level, c.name ?? "");
  return school; // "FONDAMENTAL" | "COLLEGE" | "LYCEE" | null
}

/**
 * Nom d'une classe : le niveau, suivi de la section quand l'école a
 * plusieurs classes du même niveau (« 1AF A », « 1AF B »).
 */
export function composeClassName(level: string, section?: string | null): string {
  const s = section?.trim();
  return s ? `${level.trim()} ${s}` : level.trim();
}

const SECTION_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * Nom de la nouvelle classe. Avec une section saisie, c'est « niveau
 * section ». Sans section : le niveau seul s'il n'existe pas encore cette
 * année ; sinon la lettre suivante — une « 1AF » existante compte comme la
 * section A, la nouvelle devient « 1AF B ». Le directeur n'a jamais à taper
 * une lettre pour ajouter une classe d'un niveau déjà présent.
 */
export function nextClassName(level: string, section: string | null | undefined, takenNames: string[]): string {
  if (section?.trim()) return composeClassName(level, section);
  const taken = new Set(takenNames.map((n) => normalize(n)));
  const bare = composeClassName(level);
  // Une classe du même niveau : « 1AF » elle-même, ou « 1AF » suivi d'une section.
  const prefix = bare.toLowerCase();
  const sameLevel = takenNames.some((n) => {
    const name = n.trim().toLowerCase();
    return name === prefix || name.startsWith(`${prefix} `);
  });
  if (!sameLevel) return bare;
  const letters = taken.has(normalize(bare)) ? SECTION_LETTERS.slice(1) : SECTION_LETTERS;
  const free = letters.find((l) => !taken.has(normalize(composeClassName(level, l))));
  return free ? composeClassName(level, free) : bare;
}

/** Inverse de composeClassName : la section d'une classe existante. */
export function sectionOf(name: string, level: string): string {
  const n = name.trim();
  const l = level.trim();
  if (l && n.toLowerCase().startsWith(l.toLowerCase())) return n.slice(l.length).trim();
  return "";
}

export interface CatalogGroup {
  /** Clé livrée (« LYCEE ») ou nom de la catégorie de l'école. */
  category: string;
  label: string;
  levels: string[];
  standard: boolean;
}

/**
 * Catégories et niveaux proposés à une école : les quatre catégories
 * livrées avec leurs niveaux, enrichies de ce que l'école a déjà créé
 * elle-même (un niveau ajouté au Préscolaire, une catégorie « Mahadra »).
 */
export function buildCatalog(
  classes: { category?: string | null; level: string; name?: string }[],
): CatalogGroup[] {
  const groups: CatalogGroup[] = STANDARD_CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    levels: [...STANDARD_LEVELS[category]],
    standard: true,
  }));

  for (const c of classes) {
    // Seuls les niveaux choisis avec une catégorie enrichissent la liste :
    // une ancienne classe au niveau saisi à la main (« 4 », « 5AS ») ne doit
    // pas y ajouter un bouton en double à côté des niveaux officiels.
    const category = c.category?.trim();
    if (!category || !c.level.trim()) continue;
    let group = groups.find((g) => g.category === category);
    if (!group) {
      group = { category, label: categoryLabel(category), levels: [], standard: false };
      groups.push(group);
    }
    if (!group.levels.some((l) => normalize(l) === normalize(c.level))) {
      group.levels.push(c.level.trim());
    }
  }
  return groups;
}

/**
 * Rang d'une classe pour trier la liste dans l'ordre de la scolarité :
 * catégorie, puis niveau, puis nom (sections A, B…).
 */
export function classSortKey(c: { category?: string | null; level: string; name: string }): [number, number, string] {
  const category = classCategory(c);
  const categoryRank = isStandardCategory(category)
    ? STANDARD_CATEGORIES.indexOf(category)
    : STANDARD_CATEGORIES.length;
  // Le niveau, ou à défaut le nom (« 4af » saisi avec le niveau « 4 »).
  const standard = findStandardLevel(c.level) ?? findStandardLevel(c.name);
  const levelRank = isStandardCategory(category) && standard?.category === category
    ? STANDARD_LEVELS[category].indexOf(standard.level)
    : -1;
  return [categoryRank, levelRank === -1 ? 99 : levelRank, c.name];
}

export function compareClasses(
  a: { category?: string | null; level: string; name: string },
  b: { category?: string | null; level: string; name: string },
): number {
  const [ca, la, na] = classSortKey(a);
  const [cb, lb, nb] = classSortKey(b);
  return ca - cb || la - lb || na.localeCompare(nb, "fr", { numeric: true });
}

export interface ClassOption {
  id: string;
  name: string;
  /** Catégorie de la classe (voir classCategory) ; null si non reconnue. */
  category: string | null;
}

/**
 * Classes à proposer dans une liste de choix : dans l'ordre de la scolarité,
 * chacune avec sa catégorie pour être regroupée (Préscolaire, Fondamental…).
 */
export function classOptions(
  classes: { id: string; name: string; level: string; category?: string | null }[],
): ClassOption[] {
  return [...classes]
    .sort(compareClasses)
    .map((c) => ({ id: c.id, name: c.name, category: classCategory(c) }));
}
