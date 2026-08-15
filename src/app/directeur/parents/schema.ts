import { z } from "zod";
import { phoneSchema } from "@/lib/phone";

export const parentSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis"),
  lastName: z.string().trim().min(1, "Le nom est requis"),
  phone: phoneSchema,
  email: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  relationship: z.string().trim().optional().or(z.literal("")),
  studentIds: z.array(z.string()),
});

export type ParentFormValues = z.infer<typeof parentSchema>;
