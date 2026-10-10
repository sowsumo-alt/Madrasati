"use server";

import { basePrisma, prisma } from "@/lib/prisma";
import { ACTIVITY_ACTIONS, logActivity } from "@/lib/activity";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/payment-methods";
import { reportPeriod } from "./period";

/**
 * Les encaissements de la période, ligne par ligne, pour l'export Excel du
 * rapport financier — lus à la demande, pas envoyés avec la page.
 */
export async function financialReportRows(yearId: string, month: string | null) {
  const user = await requireRole(ROLES.DIRECTOR);
  const year = await prisma.academicYear.findFirst({
    where: { id: yearId, schoolId: user.schoolId },
    select: { startDate: true, endDate: true },
  });
  if (!year) return [];
  const { from, to } = reportPeriod(year, month);
  const payments = await prisma.payment.findMany({
    where: { schoolId: user.schoolId, paidAt: { gte: from, lt: to } },
    orderBy: { paidAt: "asc" },
    select: {
      paidAt: true,
      receiptNumber: true,
      amount: true,
      method: true,
      fee: { select: { label: true } },
      student: { select: { firstName: true, lastName: true, classRoom: { select: { name: true } } } },
    },
  });
  // Qui a exporté quoi : la liste des élèves et des montants quitte l'application.
  // Écrit hors de la garde « lecture seule » : un associé en lecture seule peut
  // exporter, et la trace de son export doit rester.
  await logActivity(basePrisma, {
    schoolId: user.schoolId,
    userId: user.id,
    action: ACTIVITY_ACTIONS.EXPORT,
    summary: `Export Excel des encaissements — ${month ? `mois ${month}` : "année entière"} (${payments.length} ligne(s))`,
  });
  return payments.map((p) => ({
    Date: p.paidAt.toISOString().slice(0, 10),
    Reçu: p.receiptNumber,
    Élève: `${p.student.firstName} ${p.student.lastName}`.trim(),
    Classe: p.student.classRoom?.name ?? "",
    Frais: p.fee.label,
    Mode: PAYMENT_METHOD_LABELS[p.method as PaymentMethod] ?? p.method,
    "Montant (MRU)": p.amount,
  }));
}
