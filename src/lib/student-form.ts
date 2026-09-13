/**
 * Règles du dossier élève partagées par le formulaire, le serveur et les
 * tests (tests/student-form.test.ts).
 */

/** Nationalité préremplie : celle de la très grande majorité des élèves. */
export const DEFAULT_NATIONALITY = "Mauritanienne";

/** Suggestions proposées à la saisie ; toute autre nationalité reste possible. */
export const NATIONALITY_SUGGESTIONS = [
  "Mauritanienne",
  "Sénégalaise",
  "Malienne",
  "Marocaine",
  "Algérienne",
  "Gambienne",
  "Guinéenne",
  "Ivoirienne",
  "Française",
];

/**
 * Découpe « Mohamed Ould Ahmed » en prénom « Mohamed » et nom « Ould Ahmed ».
 * La fiche parent garde prénom et nom séparés (messages WhatsApp, comptes
 * parents), alors que le formulaire demande le nom complet en un seul champ.
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Inverse de splitFullName, pour préremplir le champ en modification. */
export function joinFullName(firstName?: string | null, lastName?: string | null): string {
  return [firstName, lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Numéros de page à afficher : la première, la dernière, la page courante et
 * ses voisines, avec « … » dans les trous. Une école de 600 élèves ne doit
 * pas aligner soixante boutons sous la liste.
 */
export function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const kept = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  kept.forEach((page, i) => {
    if (i > 0 && page - kept[i - 1] > 1) result.push("…");
    result.push(page);
  });
  return result;
}
