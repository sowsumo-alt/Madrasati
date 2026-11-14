import { z } from "zod";

/**
 * Dates saisies dans les formulaires (« AAAA-MM-JJ »). `new Date("2012-02-31")`
 * donne le 2 mars sans rien dire : une date impossible doit être refusée, pas
 * enregistrée un autre jour sur les documents officiels de l'enfant.
 */
export function isRealIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const DAY_MS = 86_400_000;

/**
 * Date facultative : vide, ou une vraie date entre `min` et aujourd'hui
 * (+ `daysAfterToday`, pour une inscription datée de la rentrée prochaine).
 */
export function optionalDateSchema(label: string, { min = "1950-01-01", daysAfterToday = 0 } = {}) {
  return z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isRealIsoDate(v), `${label} : cette date n'existe pas`)
    .refine((v) => {
      if (!v || !isRealIsoDate(v)) return true;
      const max = new Date(Date.now() + daysAfterToday * DAY_MS).toISOString().slice(0, 10);
      return v >= min && v <= max;
    }, `${label} : date hors des limites`);
}

/** Date obligatoire : une vraie date entre `min` et aujourd'hui + `daysAfterToday`. */
export function requiredDateSchema(
  required: string,
  label: string,
  { min = "2000-01-01", daysAfterToday = 3 * 366 } = {},
) {
  return z
    .string()
    .trim()
    .min(1, required)
    .refine((v) => isRealIsoDate(v), `${label} : cette date n'existe pas`)
    .refine((v) => {
      if (!isRealIsoDate(v)) return true;
      const max = new Date(Date.now() + daysAfterToday * DAY_MS).toISOString().slice(0, 10);
      return v >= min && v <= max;
    }, `${label} : date hors des limites`);
}
