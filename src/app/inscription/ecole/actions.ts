"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { hashPassword } from "@/lib/account";
import { generateTempPassword } from "@/lib/account-server";
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
  // Seule une identité Google fraîchement authentifiée mais encore "pending"
  // a le droit de créer une école ici — pas un compte déjà rattaché à une
  // école, ni un Super Admin (dont le schoolId est vide comme un compte
  // pending, mais qui n'en est pas un).
  if (!user.pending) {
    return { ok: false, error: "Votre compte ne peut pas créer d'école ici." };
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
      schoolType: parsed.data.schoolType,
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
