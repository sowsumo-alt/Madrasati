import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/roles";
import { ROLES } from "@/lib/roles";
import { planHasFeature, effectivePlan, type Feature } from "@/lib/plans";

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
    select: { mustChangePassword: true, school: { select: { subscriptionStatus: true } } },
  });
  if (account?.mustChangePassword) redirect("/mon-compte");

  // Un abonnement suspendu par le Super Admin coupe l'accès pour toute
  // l'école (directeur, enseignants, parents) tant qu'il n'est pas réactivé
  // via « Marquer comme payé ».
  if (account?.school?.subscriptionStatus === "suspended") redirect("/compte-suspendu");

  return user;
}

/**
 * Comme requireRole, mais impose en plus que la formule de l'école inclue
 * cette fonctionnalité — vérifié ici côté serveur (pas seulement caché dans
 * le menu), donc une URL directe ne suffit pas à contourner le plan.
 *
 * Un directeur atterrit sur la page « fonctionnalité verrouillée » (avec
 * l'invitation à mettre à niveau) ; un enseignant ou un parent n'a rien à
 * décider sur l'abonnement, il est simplement renvoyé vers son espace.
 */
export async function requireFeature(feature: Feature, ...roles: Role[]) {
  const user = await requireRole(...roles);

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { plan: true, subscriptionStatus: true },
  });

  const plan = school ? effectivePlan(school) : "standard";
  if (!planHasFeature(plan, feature)) {
    if (user.role === ROLES.DIRECTOR) {
      redirect(`/directeur/fonctionnalite-verrouillee?feature=${feature}`);
    }
    redirect("/");
  }

  return user;
}
