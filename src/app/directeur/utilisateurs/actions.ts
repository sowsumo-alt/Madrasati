"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { hashPassword } from "@/lib/account";
import { generateTempPassword } from "@/lib/account-server";
import { UserError, asResult } from "@/lib/user-error";
import { ACTIVITY_ACTIONS, logActivity } from "@/lib/activity";
import { ACCESS_LABELS, DIRECTOR_ACCESS, normalizeEmail, teamRefusal } from "@/lib/team";
import type { AccountResult } from "../comptes/actions";

/** Le directeur principal, et lui seul. */
async function requireOwner() {
  const user = await requireRole(ROLES.DIRECTOR);
  if (!user.isOwner) throw new UserError("Seul le directeur principal peut gérer les autres directeurs.");
  return user;
}

/** Un autre directeur de l'école, que le directeur principal peut gérer. */
async function manageableDirector(owner: { id: string; schoolId: string; role: string; isOwner: boolean }, userId: string) {
  const target = await prisma.user.findFirst({
    where: { id: userId, schoolId: owner.schoolId, role: ROLES.DIRECTOR },
    select: { id: true, schoolId: true, role: true, isOwner: true, name: true, email: true, phone: true },
  });
  const refusal = teamRefusal(owner, target);
  if (refusal || !target) throw new UserError(refusal ?? "Compte introuvable.");
  return target;
}

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Indiquez le nom de la personne.").max(120),
  email: z.string().trim().min(1, "Indiquez son adresse e-mail.").max(160),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  access: z.enum(DIRECTOR_ACCESS),
});
export type InviteValues = z.input<typeof inviteSchema>;

/**
 * Invite un associé : un compte directeur de la même école, avec son propre
 * e-mail. Le mot de passe temporaire n'est montré qu'une fois ; la personne
 * choisit le sien à la première connexion.
 */
export async function inviteDirector(values: InviteValues) {
  return asResult(async (): Promise<AccountResult> => {
    const owner = await requireOwner();
    const data = inviteSchema.parse(values);
    const email = normalizeEmail(data.email);
    if (!email) throw new UserError("Cette adresse e-mail n'est pas valide.");
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new UserError("Cette adresse e-mail a déjà un compte Madrasati.");
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          schoolId: owner.schoolId,
          email,
          passwordHash,
          role: ROLES.DIRECTOR,
          access: data.access,
          name: data.name,
          phone: data.phone || null,
          mustChangePassword: true,
        },
      });
      await logActivity(tx, {
        schoolId: owner.schoolId,
        userId: owner.id,
        action: ACTIVITY_ACTIONS.USER,
        summary: `Compte créé pour ${data.name} (${email}) — ${ACCESS_LABELS[data.access]}`,
        href: "/directeur/utilisateurs",
      });
    });

    revalidatePath("/directeur/utilisateurs");
    return { email, tempPassword, personName: data.name, phone: data.phone ?? "" };
  });
}

/** Directeur ↔ lecture seule. */
export async function setDirectorAccess(userId: string, access: (typeof DIRECTOR_ACCESS)[number]) {
  return asResult(async () => {
    const owner = await requireOwner();
    if (!DIRECTOR_ACCESS.includes(access)) throw new UserError("Rôle inconnu.");
    const target = await manageableDirector(owner, userId);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: { access } });
      await logActivity(tx, {
        schoolId: owner.schoolId,
        userId: owner.id,
        action: ACTIVITY_ACTIONS.USER,
        summary: `Rôle de ${target.name} : ${ACCESS_LABELS[access]}`,
        href: "/directeur/utilisateurs",
      });
    });
    revalidatePath("/directeur/utilisateurs");
    return {};
  });
}

/** Retire ou rend l'accès d'un associé — effet immédiat, même s'il est connecté. */
export async function setDirectorActive(userId: string, isActive: boolean) {
  return asResult(async () => {
    const owner = await requireOwner();
    const target = await manageableDirector(owner, userId);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data: { isActive } });
      await logActivity(tx, {
        schoolId: owner.schoolId,
        userId: owner.id,
        action: ACTIVITY_ACTIONS.USER,
        summary: isActive ? `Accès rendu à ${target.name}` : `Accès retiré à ${target.name}`,
        href: "/directeur/utilisateurs",
      });
    });
    revalidatePath("/directeur/utilisateurs");
    return {};
  });
}

/** Nouveau mot de passe temporaire pour un associé qui a oublié le sien. */
export async function resetDirectorPassword(userId: string) {
  return asResult(async (): Promise<AccountResult> => {
    const owner = await requireOwner();
    const target = await manageableDirector(owner, userId);
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: { passwordHash, mustChangePassword: true },
      });
      await logActivity(tx, {
        schoolId: owner.schoolId,
        userId: owner.id,
        action: ACTIVITY_ACTIONS.USER,
        summary: `Mot de passe réinitialisé pour ${target.name}`,
        href: "/directeur/utilisateurs",
      });
    });
    return { email: target.email, tempPassword, personName: target.name, phone: target.phone ?? "" };
  });
}
