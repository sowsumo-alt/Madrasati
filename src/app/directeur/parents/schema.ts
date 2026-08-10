import { z } from "zod";

export const parentSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis"),
  lastName: z.string().trim().min(1, "Le nom est requis"),
  phone: z.string().trim().min(1, "Le téléphone est requis"),
  email: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  relationship: z.string().trim().optional().or(z.literal("")),
  studentIds: z.array(z.string()),
});

export type ParentFormValues = z.infer<typeof parentSchema>;
