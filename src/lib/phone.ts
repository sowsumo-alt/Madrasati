import { z } from "zod";

/**
 * Un numéro mauritanien local à 8 chiffres (ex: "45123456") reçoit
 * automatiquement l'indicatif national 222 : sans lui, le lien wa.me généré
 * par buildWhatsAppUrl (src/lib/whatsapp.ts, qui ne garde que les chiffres)
 * pointerait vers un autre pays ou serait invalide.
 */
function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 8) return `222${digits}`;
  return digits;
}

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Le téléphone est requis")
  .transform(normalizePhone)
  .refine((v) => v.length >= 8, "Numéro de téléphone invalide");

export const optionalPhoneSchema = z
  .string()
  .trim()
  .transform((v) => (v ? normalizePhone(v) : v))
  .optional()
  .or(z.literal(""));
