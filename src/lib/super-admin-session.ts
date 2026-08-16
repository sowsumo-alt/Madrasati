import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Garde d'accès du tableau de bord propriétaire — volontairement séparée de
 * requireRole/requireUser (src/lib/session.ts), qui servent les comptes
 * d'une école (directeur/enseignant/parent). Un Super Admin n'a pas de
 * schoolId et ne doit jamais emprunter les mêmes chemins de code que ces
 * rôles, pour qu'une erreur dans l'un des deux systèmes ne puisse jamais
 * donner accès à l'autre.
 *
 * Double vérification : le rôle porté par le jeton de session, puis une
 * relecture fraîche de la table SuperAdmin (un compte supprimé perd l'accès
 * immédiatement, même si son jeton n'a pas encore expiré).
 */
export async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const id = session?.user?.id;

  if (!id || role !== "SUPER_ADMIN") {
    redirect("/super-admin/login");
  }

  const admin = await prisma.superAdmin.findUnique({ where: { id } });
  if (!admin) {
    redirect("/super-admin/login");
  }

  return admin;
}
