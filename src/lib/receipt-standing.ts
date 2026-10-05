import type { Prisma } from "@prisma/client";
import { receiptStanding, type ReceiptStanding } from "@/lib/receipt-status";

/**
 * Le reste dû et le tampon d'un reçu (lib/receipt-status.ts), lus en base.
 *
 * Le périmètre : toute la famille pour un reçu familial ou un frais de la
 * fiche familiale — « PAYÉ » veut dire que la famille est à jour —, sinon
 * l'élève seul.
 */
export async function loadReceiptStanding(
  db: Prisma.TransactionClient,
  input: { studentIds: string[]; receiptFeeIds: string[]; paidAt: Date; receiptNumber: string },
): Promise<ReceiptStanding> {
  const fees = await db.fee.findMany({
    where: { studentId: { in: [...new Set(input.studentIds)] } },
    select: {
      id: true,
      amount: true,
      dueDate: true,
      payments: { select: { amount: true, paidAt: true, receiptNumber: true } },
    },
  });
  return receiptStanding({ fees, receiptFeeIds: input.receiptFeeIds, paidAt: input.paidAt, receiptNumber: input.receiptNumber });
}

/** Les enfants d'une famille (tous, actifs ou non : leurs dettes restent celles de la famille). */
export async function familyStudentIds(db: Prisma.TransactionClient, parentId: string): Promise<string[]> {
  const links = await db.studentParent.findMany({ where: { parentId }, select: { studentId: true } });
  return links.map((l) => l.studentId);
}
