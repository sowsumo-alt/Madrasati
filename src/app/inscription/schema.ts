import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "@/lib/account";

export const signupSchema = z
  .object({
    schoolName: z.string().trim().min(2, "Le nom de l'école est requis"),
    directorName: z.string().trim().min(2, "Votre nom est requis"),
    email: z
      .string()
      .trim()
      .min(1, "L'email est requis")
      .email("Email invalide"),
    phone: z.string().trim().min(8, "Le téléphone est requis"),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Au moins ${PASSWORD_MIN_LENGTH} caractères`),
    confirm: z.string().min(1, "Confirmez le mot de passe"),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Les deux mots de passe ne correspondent pas",
  });

export type SignupValues = z.infer<typeof signupSchema>;
