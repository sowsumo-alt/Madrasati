import { z } from "zod";
import { phoneSchema } from "@/lib/phone";
import { PAYMENT_METHODS } from "@/lib/payment-methods";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** Un enfant de l'inscription groupée : les mêmes champs obligatoires que
 *  l'inscription d'un seul élève (genre et classe compris). */
export const familyChildSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis").max(80),
  lastName: z.string().trim().min(1, "Le nom est requis").max(80),
  dateOfBirth: z.string().trim().optional().or(z.literal("")),
  gender: z.string().refine((v) => ["M", "F"].includes(v), "Choisissez le genre"),
  classId: z.string().trim().min(1, "Choisissez la classe"),
  /** Frais d'inscription de cet enfant, en MRU ; 0 = aucun frais. */
  amount: z.number().int().nonnegative().max(100_000_000),
});

/**
 * « FAMILY » : un seul paiement et un seul reçu pour toute la famille.
 * « SEPARATE » : un paiement et un reçu par enfant, comme aujourd'hui.
 */
export const FAMILY_PAYMENT_MODES = ["FAMILY", "SEPARATE"] as const;
export type FamilyPaymentMode = (typeof FAMILY_PAYMENT_MODES)[number];

export const familyEnrollmentSchema = z.object({
  /** Famille déjà connue (même téléphone), à compléter plutôt que recréer. */
  existingParentId: z.string().trim().optional().or(z.literal("")),
  familyName: z.string().trim().min(1, "Indiquez le nom de la famille").max(80),
  parentName: z.string().trim().min(1, "Indiquez le nom du parent ou tuteur").max(120),
  parentPhone: phoneSchema,
  parentAddress: optionalText(200),
  children: z.array(familyChildSchema).min(1, "Ajoutez au moins un enfant").max(20),
  paymentMode: z.enum(FAMILY_PAYMENT_MODES),
  method: z.enum(PAYMENT_METHODS),
});

export type FamilyEnrollmentValues = z.infer<typeof familyEnrollmentSchema>;
export type FamilyChildValues = z.infer<typeof familyChildSchema>;

export const familyPaymentSchema = z.object({
  parts: z
    .array(z.object({ feeId: z.string().min(1), amount: z.number().int().nonnegative() }))
    .min(1)
    .max(100),
  method: z.enum(PAYMENT_METHODS),
  note: optionalText(300),
});

export type FamilyPaymentValues = z.infer<typeof familyPaymentSchema>;
