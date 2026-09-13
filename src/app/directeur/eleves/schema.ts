import { z } from "zod";
import { optionalPhoneSchema } from "@/lib/phone";
import { PAYMENT_METHODS } from "@/lib/payment-methods";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const studentSchema = z
  .object({
    firstName: z.string().trim().min(1, "Le prénom est requis"),
    lastName: z.string().trim().min(1, "Le nom est requis"),
    dateOfBirth: z.string().trim().optional().or(z.literal("")),
    // Obligatoire depuis la maquette de septembre 2026 : la répartition
    // filles / garçons des statistiques n'a de sens que si chaque élève en a un.
    gender: z.string().refine((v) => v === "M" || v === "F", "Choisissez le genre de l'élève"),
    placeOfBirth: optionalText(120),
    nationality: optionalText(60),
    // Obligatoire : un élève sans classe n'apparaît dans aucun appel, aucun
    // bulletin et aucune liste de classe — le directeur perd sa trace sans
    // qu'aucun écran ne le signale.
    classId: z.string().trim().min(1, "Choisissez la classe de l'élève"),
    status: z.enum(["ACTIVE", "INACTIVE", "TRANSFERRED", "GRADUATED"]),
    /** Jour de l'inscription, prérempli avec la date du jour. */
    enrollmentDate: z.string().trim().optional().or(z.literal("")),
    /** Photo stockée en data URI, réduite côté navigateur. */
    photoUrl: z.string().max(400_000, "Image trop lourde").nullable().optional(),
    /** Nom complet du père ou du tuteur, découpé en prénom et nom côté serveur. */
    parentName: optionalText(120),
    parentPhone: optionalPhoneSchema,
    parentAddress: optionalText(200),
    motherName: optionalText(120),
    /** Frais d'inscription, optionnel : un montant à 0 ou vide = pas de paiement. */
    enrollmentAmount: z.coerce.number().int().nonnegative().optional(),
    enrollmentMethod: z.enum(PAYMENT_METHODS).optional(),
  })
  // Une fiche parent exige un téléphone : c'est par WhatsApp que l'école la
  // joint. Un nom sans numéro, ou un numéro sans nom, ne serait enregistré
  // nulle part — autant le dire au directeur avant d'enregistrer.
  .superRefine((data, ctx) => {
    if (data.parentName && !data.parentPhone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentPhone"],
        message: "Ajoutez le téléphone du parent pour l'enregistrer",
      });
    }
    if (data.parentPhone && !data.parentName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentName"],
        message: "Indiquez le nom du parent",
      });
    }
  });

export type StudentFormValues = z.infer<typeof studentSchema>;
