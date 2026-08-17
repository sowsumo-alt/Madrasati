import { z } from "zod";
import { optionalPhoneSchema } from "@/lib/phone";
import { PAYMENT_METHODS } from "@/lib/payment-methods";

export const studentSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis"),
  lastName: z.string().trim().min(1, "Le nom est requis"),
  dateOfBirth: z.string().trim().optional().or(z.literal("")),
  gender: z.enum(["M", "F", ""]).optional(),
  // Obligatoire : un élève sans classe n'apparaît dans aucun appel, aucun
  // bulletin et aucune liste de classe — le directeur perd sa trace sans
  // qu'aucun écran ne le signale.
  classId: z.string().trim().min(1, "Choisissez la classe de l'élève"),
  status: z.enum(["ACTIVE", "INACTIVE", "TRANSFERRED", "GRADUATED"]),
  /** Photo stockée en data URI, réduite côté navigateur. */
  photoUrl: z.string().max(400_000, "Image trop lourde").nullable().optional(),
  parentFirstName: z.string().trim().optional().or(z.literal("")),
  parentLastName: z.string().trim().optional().or(z.literal("")),
  parentPhone: optionalPhoneSchema,
  /** Frais d'inscription, optionnel : un montant à 0 ou vide = pas de paiement. */
  enrollmentAmount: z.coerce.number().int().nonnegative().optional(),
  enrollmentMethod: z.enum(PAYMENT_METHODS).optional(),
});

export type StudentFormValues = z.infer<typeof studentSchema>;
