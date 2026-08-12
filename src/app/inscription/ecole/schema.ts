import { z } from "zod";

export const createSchoolSchema = z.object({
  schoolName: z.string().trim().min(2, "Le nom de l'école est requis"),
  directorName: z.string().trim().min(2, "Votre nom est requis"),
  city: z.string().trim().min(2, "La ville est requise"),
  phone: z.string().trim().min(8, "Le téléphone est requis"),
});

export type CreateSchoolValues = z.infer<typeof createSchoolSchema>;
