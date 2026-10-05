/**
 * Confirmation d'une suppression : le nom recopié doit être celui de l'élève
 * ou de la famille — casse, accents composés et espaces en trop ignorés.
 * À part de lib/removal.ts pour être utilisable dans le navigateur.
 */
export function sameName(typed: string, expected: string): boolean {
  const norm = (v: string) => v.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
  return norm(typed) !== "" && norm(typed) === norm(expected);
}
