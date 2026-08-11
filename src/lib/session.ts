import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

/** À utiliser en haut d'une page/layout serveur : redirige vers /login si non connecté. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Comme requireUser, mais impose en plus un ou plusieurs rôles autorisés.
 *
 * Vérifie aussi que le mot de passe temporaire attribué par la direction a
 * bien été remplacé : tant que ce n'est pas fait, toute page protégée renvoie
 * vers « Mon compte ». Le contrôle est fait ici, côté serveur, plutôt que dans
 * le middleware, car le jeton de session ne porte pas cette information.
 */
export async function requireRole(...roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role as Role)) redirect("/");

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { mustChangePassword: true },
  });
  if (account?.mustChangePassword) redirect("/mon-compte");

  return user;
}
