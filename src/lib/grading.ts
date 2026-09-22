/**
 * Calcul des moyennes selon le niveau de la classe.
 *
 * Deux logiques distinctes, jamais mélangées :
 *
 * - Collège et Lycée (classes AS) : la règle du bulletin officiel
 *   mauritanien, relevée sur celui du Groupe Scolaire Privé « Ngalam Avenir »
 *   et confirmée par son directeur. Dans chaque matière, un trimestre peut
 *   compter plusieurs devoirs, mais seul le meilleur est retenu :
 *   Moy T = (meilleur devoir × 3 + composition) ÷ 4.
 * - Fondamental (classes AF) et toute classe au niveau non reconnu : le
 *   calcul d'origine de Madrasati, la moyenne simple de toutes les notes de
 *   la matière. Le Fondamental a son propre bulletin officiel, qu'on n'a pas
 *   encore vu : lui appliquer la règle du secondaire fausserait toutes ses
 *   moyennes.
 *
 * Aucune dépendance à la base, pour être testé à part (tests/grading.test.ts).
 */

export type SchoolLevel = "FONDAMENTAL" | "COLLEGE" | "LYCEE";
export type GradingScheme = "SECONDARY" | "STANDARD";

/** Première année du lycée : 1AS à 4AS forment le collège. */
const FIRST_LYCEE_YEAR = 5;

function levelFrom(value: string): SchoolLevel | null {
  // « 1AS », « 1°AS1 », « 1 AS A », « 6AF » : un chiffre, puis AF ou AS.
  // La lettre qui suit AF/AS ne doit pas prolonger un mot : « 2 A Sud » ne
  // désigne pas une classe de 2AS.
  const match = /(\d+)\s*[°º.]?\s*A\.?\s?([FS])(?![a-z])/i.exec(value);
  if (match) {
    if (match[2].toUpperCase() === "F") return "FONDAMENTAL";
    return Number(match[1]) >= FIRST_LYCEE_YEAR ? "LYCEE" : "COLLEGE";
  }
  const compact = value.replace(/[\s.]/g, "").toUpperCase();
  if (compact.endsWith("AF")) return "FONDAMENTAL";
  if (compact.endsWith("AS")) return "COLLEGE";
  return null;
}

/**
 * Niveau d'une classe d'après son niveau saisi, puis son nom. Null si ni l'un
 * ni l'autre ne suit la nomenclature mauritanienne (1AF…6AF, 1AS…) : la
 * classe garde alors le calcul d'origine, plutôt qu'une règle devinée.
 */
export function schoolLevelOf(level: string, name = ""): SchoolLevel | null {
  return levelFrom(level) ?? levelFrom(name);
}

export function gradingSchemeFor(level: SchoolLevel | null): GradingScheme {
  return level === "COLLEGE" || level === "LYCEE" ? "SECONDARY" : "STANDARD";
}

/** Le meilleur devoir compte trois fois, la composition une fois. */
export const BEST_DEVOIR_WEIGHT = 3;
/** Diviseur fixe de la moyenne de matière, quel que soit le nombre de devoirs. */
export const SUBJECT_DIVISOR = 4;

/**
 * Une composition, par opposition aux devoirs (devoirs, contrôles,
 * interrogations). Les examens créés avant le champ « type » n'ont que leur
 * titre pour le dire.
 */
export function isCompositionExam(exam: { kind: string | null; title: string }): boolean {
  if (exam.kind) return exam.kind === "COMPOSITION";
  return /compo/i.test(exam.title);
}

/** Note ramenée sur 20, pour un examen noté sur un autre barème. */
export function onTwenty(score: number, maxScore: number): number {
  return maxScore === 20 || maxScore <= 0 ? score : (score / maxScore) * 20;
}

/** Arrondi au centième, comme sur le bulletin papier. */
export function roundHundredth(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface SecondarySubjectCalc {
  /** Meilleur devoir retenu, sur 20 ; null sans aucun devoir noté. */
  best: number | null;
  /** Position de ce devoir dans la liste reçue (le premier en cas d'égalité). */
  bestIndex: number | null;
  /** Colonne « Moy Int × 3 » du bulletin. */
  bestTimes3: number | null;
  composition: number | null;
  /**
   * Colonne « Moy T /20 », arrondie au centième. Null tant qu'il manque le
   * devoir ou la composition : une moyenne à moitié calculée serait fausse.
   */
  average: number | null;
}

/**
 * Moyenne d'une matière au collège et au lycée :
 * (meilleur devoir × 3 + composition) ÷ 4.
 *
 * Seul le meilleur devoir entre dans le calcul, quel que soit leur nombre —
 * ni leur moyenne, ni leur somme. Les devoirs non notés ou manqués (null)
 * sont ignorés.
 */
export function secondarySubjectAverage(
  devoirs: (number | null)[],
  composition: number | null,
): SecondarySubjectCalc {
  let bestIndex: number | null = null;
  devoirs.forEach((score, index) => {
    if (score == null) return;
    if (bestIndex == null || score > (devoirs[bestIndex] as number)) bestIndex = index;
  });

  const best = bestIndex == null ? null : (devoirs[bestIndex] as number);
  const bestTimes3 = best == null ? null : best * BEST_DEVOIR_WEIGHT;
  const average =
    bestTimes3 == null || composition == null
      ? null
      : roundHundredth((bestTimes3 + composition) / SUBJECT_DIVISOR);

  return { best, bestIndex, bestTimes3, composition, average };
}

export interface GeneralAverage {
  /** Somme des coefficients des matières qui ont une moyenne. */
  totalCoefficients: number;
  /** Somme des notes coefficientées (Moy T × coefficient). */
  totalPoints: number;
  /** Moyenne générale sur 20 ; null sans aucune matière moyennée. */
  average: number | null;
}

/**
 * Moyenne générale du trimestre : somme des notes coefficientées divisée par
 * la somme des coefficients. Une matière encore sans moyenne n'y entre pas —
 * ni ses points, ni son coefficient —, pour ne pas compter zéro à l'élève.
 */
export function generalAverage(
  lines: { average: number | null; coefficient: number }[],
): GeneralAverage {
  let totalCoefficients = 0;
  let totalPoints = 0;
  for (const line of lines) {
    if (line.average == null || line.coefficient <= 0) continue;
    totalCoefficients += line.coefficient;
    totalPoints += weightedScore(line.average, line.coefficient);
  }
  return {
    totalCoefficients,
    totalPoints: roundHundredth(totalPoints),
    average: totalCoefficients > 0 ? totalPoints / totalCoefficients : null,
  };
}

/** Colonne « Note × Coeff ». */
export function weightedScore(average: number, coefficient: number): number {
  return roundHundredth(average * coefficient);
}

/**
 * Coefficients officiels du secondaire, relevés sur le bulletin de la 1°AS1
 * du Groupe Scolaire Privé « Ngalam Avenir » (total 24), dans l'ordre où le
 * bulletin les imprime. Proposés par défaut aux classes AS ; le directeur
 * reste libre de les ajuster classe par classe.
 *
 * `aliases` : les autres noms sous lesquels une école a pu créer la même
 * matière (« Études Islamiques » est l'Instruction Religieuse, « SVT » les
 * Sciences Naturelles…), pour ne jamais créer un doublon.
 */
export const SECONDARY_OFFICIAL_SUBJECTS = [
  { name: "Arabe", nameAr: "العربية", coefficient: 5, aliases: ["langue arabe"] },
  { name: "Français", nameAr: "الفرنسية", coefficient: 4, aliases: ["langue française"] },
  { name: "Anglais", nameAr: "الإنجليزية", coefficient: 1, aliases: ["langue anglaise"] },
  { name: "Mathématiques", nameAr: "الرياضيات", coefficient: 5, aliases: ["maths", "math"] },
  {
    name: "Sciences Naturelles",
    nameAr: "العلوم الطبيعية",
    coefficient: 2,
    aliases: ["Sciences de la Vie et de la Terre", "SVT"],
  },
  {
    name: "Histoire-Géographie",
    nameAr: "التاريخ والجغرافيا",
    coefficient: 2,
    aliases: ["Histoire et Géographie", "HG"],
  },
  {
    name: "Instruction Religieuse",
    nameAr: "التربية الإسلامية",
    coefficient: 3,
    aliases: ["Études Islamiques", "Éducation Islamique", "Instruction Islamique"],
  },
  {
    name: "Instruction Civique",
    nameAr: "التربية المدنية",
    coefficient: 1,
    aliases: ["Éducation Civique"],
  },
  {
    name: "Éducation Physique",
    nameAr: "التربية البدنية",
    coefficient: 1,
    aliases: ["EPS", "Éducation Physique et Sportive", "Sport"],
  },
] as const;

export const SECONDARY_OFFICIAL_TOTAL = SECONDARY_OFFICIAL_SUBJECTS.reduce(
  (sum, s) => sum + s.coefficient,
  0,
);

function normalizeSubject(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[-–'’]/g, " ")
    .replace(/\bet\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Place d'une matière dans la liste officielle (0 = Arabe), d'après son nom
 * ou l'un de ses autres noms ; null pour une matière hors de cette liste.
 */
export function officialSubjectIndex(name: string): number | null {
  const wanted = normalizeSubject(name);
  const index = SECONDARY_OFFICIAL_SUBJECTS.findIndex((s) =>
    [s.name, ...s.aliases].some((n) => normalizeSubject(n) === wanted),
  );
  return index === -1 ? null : index;
}
