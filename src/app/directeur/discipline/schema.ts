import { z } from "zod";
import { requiredDateSchema } from "@/lib/iso-date";

export const incidentSchema = z.object({
  studentId: z.string().min(1, "Sélectionnez un élève"),
  date: requiredDateSchema("La date est requise", "Date de l'incident", { daysAfterToday: 1 }),
  type: z.enum(["WARNING", "REPRIMAND", "SUMMONS", "SUSPENSION", "OTHER"]),
  description: z.string().trim().min(1, "La description est requise"),
  sanction: z.string().trim().optional().or(z.literal("")),
});
export type IncidentFormValues = z.infer<typeof incidentSchema>;
