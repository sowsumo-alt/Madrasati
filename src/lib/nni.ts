import { z } from "zod";

/**
 * NNI — Numéro National d'Identification mauritanien, attribué à la
 * naissance : 10 chiffres. Facultatif à l'inscription (tous les élèves n'ont
 * pas encore leur extrait), mais toujours bien formé quand il est saisi.
 */

export const NNI_LENGTH = 10;

/** « 12 3456 7890 » → « 1234567890 » : on garde les chiffres tels quels. */
export function normalizeNni(value: string): string {
  return value.replace(/[\s.-]/g, "");
}

export function isValidNni(value: string): boolean {
  return new RegExp(`^\\d{${NNI_LENGTH}}$`).test(normalizeNni(value));
}

/**
 * Champ de formulaire : vide, ou 10 chiffres (espaces tolérés à la saisie).
 * Le numéro est ramené à ses seuls chiffres à l'enregistrement (storedNni).
 */
export const optionalNniSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || isValidNni(v), `Le NNI compte ${NNI_LENGTH} chiffres`);

/** Valeur à enregistrer : les 10 chiffres, ou rien. */
export function storedNni(value: string | null | undefined): string | null {
  return value ? normalizeNni(value) : null;
}
