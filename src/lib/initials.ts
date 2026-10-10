/**
 * Recherche par lettre (filtre A-Z des listes), utilisable côté serveur comme
 * dans le navigateur.
 */

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * Première lettre d'un mot, sans accent et en majuscule : « Aïcha » et
 * « Ahmed » tombent tous les deux sous A, « Élève » sous E.
 */
function normalizeLetter(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .slice(0, 1);
}

/**
 * Lettres sous lesquelles une personne doit apparaître : l'initiale de
 * *chacun* de ses noms, pas seulement celle du nom de famille.
 *
 * C'est délibéré pour la Mauritanie : avec les particules « Ould » et
 * « Mint », classer sur le seul nom de famille entasserait la moitié de
 * l'école sous O et M, et un directeur qui cherche « Fatimetou Mint Salem »
 * sous S ne la trouverait pas. Ici elle répond à F, à M et à S — la
 * recherche ne cache jamais quelqu'un parce qu'on a pensé à lui sous un
 * autre de ses noms.
 */
export function initialsOf(fullName: string): string[] {
  return [
    ...new Set(
      fullName
        .split(/[\s'’-]+/)
        .filter(Boolean)
        .map(normalizeLetter)
        .filter((l) => LETTERS.includes(l)),
    ),
  ];
}

/** Le nom correspond-il à la lettre choisie ? `letter` nul = aucun filtre. */
export function matchesLetter(fullName: string, letter: string | null) {
  return !letter || initialsOf(fullName).includes(letter);
}

/** Lettres qui ont au moins un nom : les autres sont grisées dans le filtre. */
export function lettersOf(names: string[]): string[] {
  const found = new Set(names.flatMap(initialsOf));
  return LETTERS.filter((l) => found.has(l));
}
