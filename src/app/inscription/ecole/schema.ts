import { z } from "zod";
import { SCHOOL_TYPES } from "@/lib/school-levels";

export const createSchoolSchema = z.object({
  schoolName: z.string().trim().min(2, "Le nom de l'école est requis"),
  // Détermine les classes créées automatiquement avec l'école.
  schoolType: z.enum(SCHOOL_TYPES),
  directorName: z.string().trim().min(2, "Votre nom est requis"),
  city: z.string().trim().min(2, "La ville est requise"),
  phone: z.string().trim().min(8, "Le téléphone est requis"),
});

export type CreateSchoolValues = z.infer<typeof createSchoolSchema>;
