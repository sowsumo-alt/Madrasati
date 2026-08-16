"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import {
  hashPassword,
  buildLoginEmail,
  schoolSlug,
} from "@/lib/account";
import { generateTempPassword } from "@/lib/account-server";
import { planHasFeature, FEATURES } from "@/lib/plans";

export interface AccountResult {
  email: string;
  tempPassword: string;
  personName: string;
  phone: string;
}

/** Trouve une adresse libre : jean.dupont@…, puis jean.dupont2@… */
async function uniqueEmail(base: string) {
  const [local, domain] = base.split("@");
  let candidate = base;
  let suffix = 2;
  while (await prisma.user.findUnique({ where: { email: candidate } })) {
    candidate = `${local}${suffix}@${domain}`;
    suffix += 1;
  }
  return candidate;
}

/**
 * Crée un accès à l'application pour un enseignant.
 * Le mot de passe temporaire n'est renvoyé qu'une seule fois, au moment de la
 * création : il n'est stocké que sous forme chiffrée et ne pourra plus être
 * relu ensuite — seulement réinitialisé.
 */
export async function createTeacherAccount(teacherId: string): Promise<AccountResult> {
  const user = await requireRole(ROLES.DIRECTOR);

  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, schoolId: user.schoolId },
  });
  if (!teacher) throw new Error("Enseignant introuvable.");
  if (teacher.userId) throw new Error("Cet enseignant a déjà un accès.");

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true },
  });

  const email = await uniqueEmail(
    teacher.email?.trim().toLowerCase() ||
      buildLoginEmail(
        teacher.firstName,
        teacher.lastName,
        `${schoolSlug(school?.name ?? "ecole")}.mr`,
      ),
  );
  const tempPassword = generateTempPassword();

  const created = await prisma.user.create({
    data: {
      schoolId: user.schoolId,
      email,
      passwordHash: await hashPassword(tempPassword),
      role: ROLES.TEACHER,
      name: `${teacher.firstName} ${teacher.lastName}`,
      phone: teacher.phone,
      mustChangePassword: true,
    },
  });

  await prisma.teacher.update({
    where: { id: teacher.id },
    data: { userId: created.id },
  });

  revalidatePath("/directeur/enseignants");
  return {
    email,
    tempPassword,
    personName: `${teacher.firstName} ${teacher.lastName}`,
    phone: teacher.phone,
  };
}

/** Même principe pour un parent. */
export async function createParentAccount(parentId: string): Promise<AccountResult> {
  const user = await requireRole(ROLES.DIRECTOR);

  const parent = await prisma.parent.findFirst({
    where: { id: parentId, schoolId: user.schoolId },
  });
  if (!parent) throw new Error("Parent introuvable.");
  if (parent.userId) throw new Error("Ce parent a déjà un accès.");

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true, plan: true },
  });
  if (!planHasFeature(school?.plan, FEATURES.PARENT_PORTAL)) {
    throw new Error(
      "Le portail parents fait partie du plan Avancé. Mettez à niveau votre abonnement dans Paramètres pour l'activer.",
    );
  }

  const email = await uniqueEmail(
    parent.email?.trim().toLowerCase() ||
      buildLoginEmail(
        parent.firstName,
        parent.lastName,
        `${schoolSlug(school?.name ?? "ecole")}.mr`,
      ),
  );
  const tempPassword = generateTempPassword();

  const created = await prisma.user.create({
    data: {
      schoolId: user.schoolId,
      email,
      passwordHash: await hashPassword(tempPassword),
      role: ROLES.PARENT,
      name: `${parent.firstName} ${parent.lastName}`,
      phone: parent.phone,
      mustChangePassword: true,
    },
  });

  await prisma.parent.update({
    where: { id: parent.id },
    data: { userId: created.id },
  });

  revalidatePath("/directeur/parents");
  return {
    email,
    tempPassword,
    personName: `${parent.firstName} ${parent.lastName}`,
    phone: parent.phone,
  };
}

/**
 * Remplace le mot de passe d'un utilisateur de l'école par un nouveau mot de
 * passe temporaire. C'est la réponse à « j'ai oublié mon mot de passe » : le
 * directeur réinitialise et transmet par WhatsApp, sans serveur d'email.
 */
export async function resetUserPassword(userId: string): Promise<AccountResult> {
  const director = await requireRole(ROLES.DIRECTOR);

  const target = await prisma.user.findFirst({
    where: { id: userId, schoolId: director.schoolId },
  });
  if (!target) throw new Error("Compte introuvable.");
  if (target.id === director.id) {
    throw new Error(
      "Pour votre propre mot de passe, utilisez la page « Mon compte ».",
    );
  }

  const tempPassword = generateTempPassword();
  await prisma.user.update({
    where: { id: target.id },
    data: {
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
    },
  });

  revalidatePath("/directeur/enseignants");
  revalidatePath("/directeur/parents");
  return {
    email: target.email,
    tempPassword,
    personName: target.name,
    phone: target.phone ?? "",
  };
}

/** Suspend ou réactive un accès sans supprimer la fiche de la personne. */
export async function setAccountActive(userId: string, isActive: boolean) {
  const director = await requireRole(ROLES.DIRECTOR);

  const target = await prisma.user.findFirst({
    where: { id: userId, schoolId: director.schoolId },
  });
  if (!target) throw new Error("Compte introuvable.");
  if (target.id === director.id) {
    throw new Error("Vous ne pouvez pas désactiver votre propre accès.");
  }

  await prisma.user.update({ where: { id: target.id }, data: { isActive } });

  revalidatePath("/directeur/enseignants");
  revalidatePath("/directeur/parents");
}
