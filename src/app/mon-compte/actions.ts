"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { hashPassword, PASSWORD_MIN_LENGTH } from "@/lib/account";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Mot de passe actuel requis"),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Au moins ${PASSWORD_MIN_LENGTH} caractères`),
    confirmPassword: z.string().min(1, "Confirmation requise"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Les deux mots de passe ne sont pas identiques",
    path: ["confirmPassword"],
  });

export type ChangePasswordValues = z.infer<typeof schema>;

export async function changeOwnPassword(values: ChangePasswordValues) {
  const sessionUser = await requireUser();
  const data = schema.parse(values);

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) throw new Error("Compte introuvable.");

  const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!valid) throw new Error("Le mot de passe actuel est incorrect.");

  if (await bcrypt.compare(data.newPassword, user.passwordHash)) {
    throw new Error("Choisissez un mot de passe différent de l'actuel.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(data.newPassword),
      mustChangePassword: false,
    },
  });
}
