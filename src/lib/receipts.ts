import type { Prisma } from "@prisma/client";

/**
 * Numéro de reçu séquentiel par école et par année, ex: REC-2026-0001.
 * Doit être appelé depuis une transaction Prisma en isolation Serializable
 * (le client `tx`) : l'appelant est responsable de retenter (numéro de reçu
 * en collision, code Prisma P2002/P2034) si deux paiements sont enregistrés
 * au même instant — un simple `count()` ne verrouille rien à lui seul.
 */
export async function generateReceiptNumber(
  tx: Prisma.TransactionClient,
  schoolId: string,
) {
  const year = new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const startOfNextYear = new Date(year + 1, 0, 1);
  const count = await tx.payment.count({
    where: { schoolId, paidAt: { gte: startOfYear, lt: startOfNextYear } },
  });
  return `REC-${year}-${String(count + 1).padStart(4, "0")}`;
}
