import { z } from "zod";
import { optionalDateSchema } from "@/lib/iso-date";
import { phoneSchema } from "@/lib/phone";

export const teacherSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis"),
  lastName: z.string().trim().min(1, "Le nom est requis"),
  phone: phoneSchema,
  email: z.string().trim().optional().or(z.literal("")),
  diploma: z.string().trim().optional().or(z.literal("")),
  subjectSpecialty: z.string().trim().optional().or(z.literal("")),
  monthlySalary: z.string().trim().optional().or(z.literal("")),
  hireDate: optionalDateSchema("Date d'embauche", { min: "1960-01-01", daysAfterToday: 366 }),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export type TeacherFormValues = z.infer<typeof teacherSchema>;
