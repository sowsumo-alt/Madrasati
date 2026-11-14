"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { UserError, asResult } from "@/lib/user-error";
import { runWithReceipt } from "@/lib/receipts";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { correctFeePayments } from "@/lib/payment-correction";

const schema = z.object({
  /** La fiche d'une famille, ou d'un élève seul. */
  parentId: z.string().min(1).nullable().optional(),
  studentId: z.string().min(1).nullable().optional(),
  /** Ce qui a vraiment été versé, ligne par ligne (MRU). */
  changes: z.array(z.object({ feeId: z.string().min(1), paid: z.number().int().min(0) })).min(1).max(500),
  /** Mode du reçu de complément, s'il a été versé plus que noté. */
  method: z.enum(PAYMENT_METHODS),
  reason: z.string().max(300),
  submissionKey: z.string().max(64).optional(),
});

/**
 * Corriger la fiche de paiement d'une famille ou d'un élève (voir
 * lib/payment-correction.ts) : seuls ses propres frais peuvent changer.
 */
export async function correctSheetAction(input: z.infer<typeof schema>) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    const data = schema.parse(input);

    let studentIds: string[];
    if (data.parentId) {
      const parent = await prisma.parent.findFirst({
        where: { id: data.parentId, schoolId: user.schoolId },
        select: { studentLinks: { select: { studentId: true } } },
      });
      if (!parent) throw new UserError("Famille introuvable.");
      studentIds = parent.studentLinks.map((l) => l.studentId);
    } else if (data.studentId) {
      const student = await prisma.student.findFirst({ where: { id: data.studentId, schoolId: user.schoolId }, select: { id: true } });
      if (!student) throw new UserError("Élève introuvable.");
      studentIds = [student.id];
    } else {
      throw new UserError("Fiche introuvable.");
    }

    const result = await runWithReceipt(
      user.schoolId,
      (tx, attempt) =>
        correctFeePayments(tx, {
          schoolId: user.schoolId,
          userId: user.id,
          attempt,
          studentIds,
          changes: data.changes,
          method: data.method,
          reason: data.reason,
        }),
      { submissionKey: data.submissionKey },
    );

    for (const path of ["/directeur/finance", "/directeur/fiche", "/directeur", "/directeur/eleves", "/directeur/rappels"]) {
      revalidatePath(path);
    }
    revalidatePath("/directeur/familles", "layout");
    return result;
  });
}
