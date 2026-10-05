import type { Prisma } from "@prisma/client";

/**
 * Journal d'activité de l'école : qui a fait quoi, et quand. Chaque action
 * importante — encaissement, annulation, suppression, archivage, inscription,
 * fiche de paiement, gestion des comptes — y laisse une ligne, écrite dans
 * la même transaction que l'action elle-même : pas d'action sans trace.
 */
export const ACTIVITY_ACTIONS = {
  PAYMENT: "PAYMENT",
  CANCEL: "CANCEL",
  DELETE: "DELETE",
  ARCHIVE: "ARCHIVE",
  ENROLL: "ENROLL",
  SHEET: "SHEET",
  USER: "USER",
} as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[keyof typeof ACTIVITY_ACTIONS];

export const ACTIVITY_LABELS: Record<ActivityAction, string> = {
  PAYMENT: "Paiement",
  CANCEL: "Annulation",
  DELETE: "Suppression",
  ARCHIVE: "Archivage",
  ENROLL: "Inscription",
  SHEET: "Fiche de paiement",
  USER: "Comptes",
};

export async function logActivity(
  db: Prisma.TransactionClient,
  entry: {
    schoolId: string;
    userId: string;
    action: ActivityAction;
    summary: string;
    amount?: number | null;
    href?: string | null;
  },
) {
  // Le nom tel qu'il est aujourd'hui : il reste lisible si le compte est retiré.
  const user = await db.user.findUnique({ where: { id: entry.userId }, select: { name: true } });
  await db.activityLog.create({
    data: {
      schoolId: entry.schoolId,
      userId: user ? entry.userId : null,
      userName: user?.name ?? "Compte inconnu",
      action: entry.action,
      summary: entry.summary,
      amount: entry.amount ?? null,
      href: entry.href ?? null,
    },
  });
}

/** Un encaissement : le numéro du reçu, les élèves concernés, le total. */
export async function logPayment(
  db: Prisma.TransactionClient,
  entry: {
    schoolId: string;
    userId: string;
    receiptNumber: string;
    total: number;
    studentIds: string[];
    href: string;
  },
) {
  const students = await db.student.findMany({
    where: { id: { in: [...new Set(entry.studentIds)] } },
    select: { firstName: true, lastName: true },
  });
  const names = students.map((s) => `${s.firstName} ${s.lastName}`.trim()).join(", ");
  await logActivity(db, {
    schoolId: entry.schoolId,
    userId: entry.userId,
    action: ACTIVITY_ACTIONS.PAYMENT,
    summary: `Reçu ${entry.receiptNumber}${names ? ` — ${names}` : ""}`,
    amount: entry.total,
    href: entry.href,
  });
}
