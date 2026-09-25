/**
 * Niveau d'une classe, moyenne générale et coefficients de référence.
 *
 * Ce fichier ne contient aucune formule de matière : la façon de calculer une
 * moyenne appartient à chaque école et vit dans lib/grading-config.ts. Ici
 * on ne décide que de deux choses communes à toutes :
 *
 * - à quel cycle appartient une classe (Fondamental, Collège, Lycée), donc
 *   laquelle des deux règles de l'école s'applique et quel bulletin est
 *   imprimé ;
 * - comment les moyennes de matières, une fois calculées, se combinent en
 *   moyenne générale : somme des notes coefficientées ÷ somme des
 *   coefficients.
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
  // Les séries du lycée mauritanien : « 5C », « 6°D », « 7°C », « 7 LM »
  // (lettres modernes), « 7 LO » (lettres originelles). Sans cela, une 7°C
  // passait pour une classe de niveau inconnu et perdait sa règle de calcul.
  const series = /(\d)\s*[°º.]?\s*(C|D|LM|LO|O|E|T)(?![a-z])/i.exec(value);
  if (series && Number(series[1]) >= FIRST_LYCEE_YEAR && Number(series[1]) <= 7) return "LYCEE";
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

/** Note ramenée sur 20, pour un examen noté sur un autre barème. */
export function onTwenty(score: number, maxScore: number): number {
  return maxScore === 20 || maxScore <= 0 ? score : (score / maxScore) * 20;
}

/** Arrondi au centième, comme sur le bulletin papier. */
export function roundHundredth(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
