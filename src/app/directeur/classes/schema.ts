import { z } from "zod";

/**
 * Une classe se décrit par sa catégorie, son niveau et, s'il y a plusieurs
 * classes du même niveau, sa section : son nom en découle (« 1AF A »).
 */
export const classSchema = z.object({
  category: z.string().trim().min(1, "Choisissez une catégorie").max(60),
  level: z.string().trim().min(1, "Choisissez un niveau").max(40),
  section: z.string().trim().max(20).optional().or(z.literal("")),
  // La capacité n'est plus demandée : une école ne la connaît pas en créant
  // ses classes, ce sont les inscriptions qui remplissent la classe.
  capacity: z.coerce.number().int().positive().optional(),
  mainTeacherId: z.string().optional().or(z.literal("")),
});
export type ClassFormValues = z.infer<typeof classSchema>;

export const subjectSchema = z.object({
  name: z.string().trim().min(1, "Le nom de la matière est requis"),
  nameAr: z.string().trim().optional().or(z.literal("")),
  coefficient: z.coerce.number().int().positive("Le coefficient doit être positif"),
});
export type SubjectFormValues = z.infer<typeof subjectSchema>;
