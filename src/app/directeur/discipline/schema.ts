import { z } from "zod";

export const incidentSchema = z.object({
  studentId: z.string().min(1, "Sélectionnez un élève"),
  date: z.string().trim().min(1, "La date est requise"),
  type: z.enum(["WARNING", "REPRIMAND", "SUMMONS", "SUSPENSION", "OTHER"]),
  description: z.string().trim().min(1, "La description est requise"),
  sanction: z.string().trim().optional().or(z.literal("")),
});
export type IncidentFormValues = z.infer<typeof incidentSchema>;
