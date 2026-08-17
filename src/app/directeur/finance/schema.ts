import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/payment-methods";

export const feeSchema = z.object({
  studentId: z.string().min(1, "Sélectionnez un élève"),
  label: z.string().trim().min(1, "Le libellé est requis"),
  amount: z.coerce.number().int().positive("Le montant doit être positif"),
  dueDate: z.string().trim().min(1, "La date d'échéance est requise"),
});
export type FeeFormValues = z.infer<typeof feeSchema>;

export const paymentSchema = z.object({
  amount: z.coerce.number().int().positive("Le montant doit être positif"),
  method: z.enum(PAYMENT_METHODS),
  note: z.string().trim().optional().or(z.literal("")),
});
export type PaymentFormValues = z.infer<typeof paymentSchema>;
