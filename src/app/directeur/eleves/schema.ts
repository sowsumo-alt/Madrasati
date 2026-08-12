import { z } from "zod";

export const studentSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis"),
  lastName: z.string().trim().min(1, "Le nom est requis"),
  dateOfBirth: z.string().trim().optional().or(z.literal("")),
  gender: z.enum(["M", "F", ""]).optional(),
  classId: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "TRANSFERRED", "GRADUATED"]),
  /** Photo stockée en data URI, réduite côté navigateur. */
  photoUrl: z.string().max(400_000, "Image trop lourde").nullable().optional(),
  parentFirstName: z.string().trim().optional().or(z.literal("")),
  parentLastName: z.string().trim().optional().or(z.literal("")),
  parentPhone: z.string().trim().optional().or(z.literal("")),
  /** Frais d'inscription, optionnel : un montant à 0 ou vide = pas de paiement. */
  enrollmentAmount: z.coerce.number().int().nonnegative().optional(),
  enrollmentMethod: z.enum(["CASH", "BANK_TRANSFER", "MASRVI", "SEDAD"]).optional(),
});

export type StudentFormValues = z.infer<typeof studentSchema>;
