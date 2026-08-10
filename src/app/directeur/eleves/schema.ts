import { z } from "zod";

export const studentSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis"),
  lastName: z.string().trim().min(1, "Le nom est requis"),
  dateOfBirth: z.string().trim().optional().or(z.literal("")),
  gender: z.enum(["M", "F", ""]).optional(),
  classId: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "TRANSFERRED", "GRADUATED"]),
  parentFirstName: z.string().trim().optional().or(z.literal("")),
  parentLastName: z.string().trim().optional().or(z.literal("")),
  parentPhone: z.string().trim().optional().or(z.literal("")),
});

export type StudentFormValues = z.infer<typeof studentSchema>;
