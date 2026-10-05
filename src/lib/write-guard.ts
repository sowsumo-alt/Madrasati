import { UserError } from "@/lib/user-error";

/**
 * Accès « lecture seule » d'un directeur associé : il consulte tout, il ne
 * modifie rien.
 *
 * Le contrôle n'est pas confié à chaque action une par une — une action
 * oubliée laisserait passer une écriture. Il est fait une seule fois, au
 * niveau du client Prisma (lib/prisma.ts) : pendant une action serveur (la
 * seule façon pour un utilisateur de modifier les données), toute écriture
 * demandée par un compte en lecture seule, ou par un compte désactivé, est
 * refusée. Les pages, elles, s'affichent normalement.
 *
 * Seule exception : changer son propre mot de passe (page « Mon compte »).
 */

export const READ_ONLY_MESSAGE =
  "Votre accès est en lecture seule : vous pouvez tout consulter, mais pas modifier. Demandez au directeur principal.";
export const INACTIVE_MESSAGE = "Votre accès a été retiré par le directeur principal.";

export const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

export interface AccountAccess {
  role: string;
  access: string;
  isActive: boolean;
}

/**
 * Ce qu'un compte peut écrire. Sans dépendance à la base ni à Next.js :
 * testé à part (tests/team.test.ts).
 */
export function writeRefusal(
  account: AccountAccess | null,
  write: { model: string; selfUpdate: boolean },
): string | null {
  if (!account) return null; // pas un compte d'école (inscription, Super Admin)
  if (write.model === "User" && write.selfUpdate) return null; // son propre mot de passe
  if (!account.isActive) return INACTIVE_MESSAGE;
  if (account.role === "DIRECTOR" && account.access === "READ_ONLY") return READ_ONLY_MESSAGE;
  return null;
}

// Un seul contrôle par requête : le compte est relu une fois, pas à chaque écriture.
const perRequest = new WeakMap<object, Promise<{ userId: string; account: AccountAccess | null } | null>>();

export async function guardWrite(
  model: string,
  args: unknown,
  lookup: (userId: string) => Promise<AccountAccess | null>,
) {
  let requestHeaders: Headers;
  try {
    const { headers } = await import("next/headers");
    requestHeaders = await headers();
  } catch {
    return; // hors d'une requête : scripts, tâches du système
  }
  // Seules les actions serveur modifient les données à la demande d'un utilisateur.
  if (!requestHeaders.get("next-action")) return;

  let current = perRequest.get(requestHeaders);
  if (!current) {
    current = (async () => {
      const [{ getServerSession }, { authOptions }] = await Promise.all([import("next-auth"), import("@/lib/auth")]);
      const session = await getServerSession(authOptions);
      const userId = session?.user?.id;
      if (!userId || session.user.role === "SUPER_ADMIN") return null;
      return { userId, account: await lookup(userId) };
    })();
    perRequest.set(requestHeaders, current);
  }
  const who = await current;
  if (!who) return;
  const where = (args as { where?: { id?: unknown } } | undefined)?.where;
  const refusal = writeRefusal(who.account, { model, selfUpdate: where?.id === who.userId });
  if (refusal) throw new UserError(refusal);
}
