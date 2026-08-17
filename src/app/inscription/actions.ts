"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/account";
import { createSchoolWithDirector } from "@/lib/school-setup";
import { signupSchema, type SignupValues } from "./schema";

export type SignupResult = { ok: true } | { ok: false; error: string };

/**
 * Inscription d'une nouvelle école. Le compte créé est immédiatement
 * utilisable : c'est le directeur lui-même qui choisit son mot de passe, il
 * n'y a donc pas de mot de passe temporaire à changer ensuite.
 */
export async function registerSchool(values: SignupValues): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Certaines informations sont incomplètes." };
  }

  const email = parsed.data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      ok: false,
      error: "Un compte existe déjà avec cet email. Connectez-vous plutôt.",
    };
  }

  try {
    await createSchoolWithDirector({
      schoolName: parsed.data.schoolName,
      directorName: parsed.data.directorName,
      email,
      phone: parsed.data.phone,
      schoolType: parsed.data.schoolType,
      passwordHash: await hashPassword(parsed.data.password),
    });
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "La création de l'école a échoué. Réessayez dans un instant.",
    };
  }
}
