import { z } from "zod";

/**
 * Photo d'élève et logo : uniquement une image encodée dans la page
 * (« data:image/… »), comme la produit le sélecteur d'image. Une adresse
 * externe servirait de pisteur (adresse IP de qui ouvre la fiche) ; un
 * « javascript: » ou un « data:text/html » n'a rien à faire là.
 */
const IMAGE_DATA_URI = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

export const INVALID_IMAGE = "Image invalide : choisissez une photo (JPEG, PNG ou WebP).";

export function isImageDataUri(value: string) {
  return IMAGE_DATA_URI.test(value);
}

/** Champ image facultatif : vide, null, ou une image encodée de `max` caractères au plus. */
export function imageDataUriSchema(max: number) {
  return z
    .string()
    .max(max, "Image trop lourde")
    .refine((v) => v === "" || isImageDataUri(v), INVALID_IMAGE)
    .nullable()
    .optional();
}
