"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SIGNUP_PER_ADDRESS, clientAddress, isLimited, recordAttempt } from "@/lib/rate-limit";
import { hashPassword } from "@/lib/account";
import { createSchoolWithDirector } from "@/lib/school-setup";
import { signupSchema, type SignupValues } from "./schema";

export type SignupResult = { ok: true } | { ok: false; error: string };

/**
 * Même réponse pour un e-mail déjà inscrit et pour un échec technique : le
 * formulaire public ne confirme jamais qu'un compte existe (sinon il servirait
 * à repérer les e-mails des directeurs avant d'essayer leurs mots de passe).
 */
const SIGNUP_NOT_DONE =
  "La création de l'école n'a pas abouti. Si vous avez déjà un compte Madrasati, connectez-vous ; sinon, réessayez dans un instant ou contactez l'assistance.";

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

  // Création d'écoles en rafale depuis une même connexion : freinée.
  const addressKey = `signup-ip:${clientAddress((await headers()).get("x-forwarded-for"))}`;
  if (await isLimited(addressKey, SIGNUP_PER_ADDRESS)) {
    return {
      ok: false,
      error: "Trop d'écoles créées depuis cette connexion. Réessayez dans une heure ou contactez l'assistance.",
    };
  }
  await recordAttempt(addressKey, SIGNUP_PER_ADDRESS);

  const email = parsed.data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: SIGNUP_NOT_DONE };
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
    return { ok: false, error: SIGNUP_NOT_DONE };
  }
}
