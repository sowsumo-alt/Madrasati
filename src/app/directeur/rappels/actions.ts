"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { UserError, asResult } from "@/lib/user-error";
import { loadReminderGroups } from "@/lib/payment-reminder-data";

/**
 * Note qu'un rappel vient de partir sur WhatsApp : la famille affiche alors
 * « rappel envoyé le … » et passe dans « Déjà relancées ». Le montant et les
 * mois notés sont recalculés ici, au moment de l'envoi.
 */
export async function recordReminder(groupKey: string) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    const { groups } = await loadReminderGroups(user.schoolId);
    const group = groups.find((g) => g.key === groupKey);
    if (!group) throw new UserError("Cette famille n'a plus rien de dû : aucun rappel à envoyer.");
    const account = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
    const reminder = await prisma.paymentReminder.create({
      data: {
        schoolId: user.schoolId,
        groupKey: group.key,
        amount: group.total,
        months: group.lines.map((l) => l.label).join(", "),
        userId: user.id,
        userName: account?.name ?? "Directeur",
      },
      select: { sentAt: true, userName: true, amount: true },
    });
    revalidatePath("/directeur/rappels");
    return { sentAt: reminder.sentAt.toISOString(), userName: reminder.userName, amount: reminder.amount };
  });
}
