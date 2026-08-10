import { z } from "zod";

export const TERMS = ["Trimestre 1", "Trimestre 2", "Trimestre 3"] as const;

export const examSchema = z.object({
  classId: z.string().min(1, "Sélectionnez une classe"),
  subjectId: z.string().min(1, "Sélectionnez une matière"),
  title: z.string().trim().min(1, "Le titre est requis"),
  term: z.enum(TERMS),
  date: z.string().trim().min(1, "La date est requise"),
  durationMinutes: z.string().trim().optional().or(z.literal("")),
  maxScore: z.coerce.number().positive("La note maximale doit être positive"),
});
export type ExamFormValues = z.infer<typeof examSchema>;
