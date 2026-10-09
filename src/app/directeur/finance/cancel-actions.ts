"use server";

import { revalidatePath } from "next/cache";
import { lockSchoolReceipts } from "@/lib/receipts";
import { z } from "zod";
import { prepareWriteGuard, prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { asResult } from "@/lib/user-error";
import { cancelReceipt } from "@/lib/payment-cancel";

const schema = z.object({
  /** Un paiement ; s'il fait partie d'un reçu familial, tout le reçu est annulé. */
  paymentId: z.string().min(1).optional(),
  familyPaymentId: z.string().min(1).optional(),
  reason: z.string().max(300),
});

/**
 * Annule un reçu (voir lib/payment-cancel.ts) : motif obligatoire, réservé
 * au directeur. Renvoie le montant annulé, ou la raison d'un refus.
 */
export async function cancelPaymentAction(input: z.infer<typeof schema>) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    const data = schema.parse(input);
    const target = data.familyPaymentId
      ? { familyPaymentId: data.familyPaymentId }
      : { paymentId: data.paymentId ?? "" };
    // Même verrou que les encaissements : une annulation ne croise jamais un
    // paiement en cours sur le même frais (statut du frais recalculé juste).
    await prepareWriteGuard();
    const result = await prisma.$transaction(
      async (tx) => {
        await lockSchoolReceipts(tx, user.schoolId);
        return cancelReceipt(tx, { schoolId: user.schoolId, userId: user.id, reason: data.reason, target });
      },
      { timeout: 40_000 },
    );
    revalidatePath("/directeur/finance");
    revalidatePath("/directeur/familles", "layout");
    revalidatePath("/directeur/parents");
    revalidatePath("/directeur");
    return result;
  });
}
