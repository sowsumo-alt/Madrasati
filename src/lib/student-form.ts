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

// La pagination sert désormais à plusieurs listes (élèves, examens) : elle
// vit dans src/lib/pagination.ts, réexportée ici pour les appels existants.
export { pageNumbers } from "./pagination";
