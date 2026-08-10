import { z } from "zod";

export const classSchema = z.object({
  name: z.string().trim().min(1, "Le nom de la classe est requis"),
  level: z.string().trim().min(1, "Le niveau est requis"),
  capacity: z.coerce.number().int().positive("La capacité doit être positive"),
  mainTeacherId: z.string().optional().or(z.literal("")),
});
export type ClassFormValues = z.infer<typeof classSchema>;

export const subjectSchema = z.object({
  name: z.string().trim().min(1, "Le nom de la matière est requis"),
  coefficient: z.coerce.number().int().positive("Le coefficient doit être positif"),
});
export type SubjectFormValues = z.infer<typeof subjectSchema>;
