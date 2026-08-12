import type { Prisma } from "@prisma/client";

/**
 * Numéro de reçu séquentiel par école, ex: REC-2026-0001. Doit être appelé
 * depuis une transaction Prisma (le client `tx`) pour que le comptage et la
 * création du paiement restent cohérents entre deux paiements simultanés.
 */
export async function generateReceiptNumber(
  tx: Prisma.TransactionClient,
  schoolId: string,
) {
  const year = new Date().getFullYear();
  const count = await tx.payment.count({ where: { schoolId } });
  return `REC-${year}-${String(count + 1).padStart(4, "0")}`;
}
