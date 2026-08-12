"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { hashPassword, generateTempPassword } from "@/lib/account";
import { createSchoolWithDirector } from "@/lib/school-setup";
import { createSchoolSchema, type CreateSchoolValues } from "./schema";

export type CreateSchoolResult = { ok: true } | { ok: false; error: string };

/**
 * Termine l'inscription d'un directeur arrivé via Google : à ce stade son
 * identité (email/nom) n'existe que dans le jeton de session (pending),
 * aucune ligne n'a encore été écrite en base. On génère un mot de passe
 * aléatoire jamais communiqué — ce directeur se connectera toujours via
 * Google — exactement comme un compte enseignant/parent créé par un
 * directeur (src/lib/account.ts).
 */
export async function completeGoogleSignup(
  values: CreateSchoolValues,
): Promise<CreateSchoolResult> {
  const user = await requireUser();
  if (user.schoolId) {
    return { ok: false, error: "Votre compte est déjà rattaché à une école." };
  }
  if (!user.email) {
    return { ok: false, error: "Adresse email introuvable sur votre compte Google." };
  }

  const parsed = createSchoolSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Certaines informations sont incomplètes." };
  }

  const email = user.email.toLowerCase();
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
      city: parsed.data.city,
      passwordHash: await hashPassword(generateTempPassword()),
    });
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "La création de l'école a échoué. Réessayez dans un instant.",
    };
  }
}
