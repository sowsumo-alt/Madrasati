import { prisma } from "@/lib/prisma";
import { loadDueRule } from "@/lib/due-rule-data";
import { effectiveDueDate, payByDate } from "@/lib/due-rule";
import { feeDisplayStatus, remainingOf } from "@/lib/fee-status";
import { collectionRate, daysOverdue, feeListDay } from "@/lib/payments-list";
import { isInMonth, lastMonthKeys, monthlySums, percentChange } from "@/lib/dashboard-data";
import type { FeeRow, PaymentsKpis } from "./finance-view";

/**
 * Tous les frais de l'école, avec statut, retard et tendances calculés au
 * serveur (lus dans le navigateur, un frais échu à minuit pouvait changer de
 * badge entre le HTML reçu et l'hydratation).
 *
 * Les photos ne sont pas chargées ici : seules celles de la page affichée le
 * sont (withPhotos) — une photo par ligne, sur des milliers de frais, pesait
 * plusieurs mégaoctets.
 */
export async function loadPaymentsData(schoolId: string, now = new Date()) {
  const [fees, dueRule] = await Promise.all([
    prisma.fee.findMany({
      where: { schoolId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            classId: true,
            classRoom: { select: { name: true } },
            parentLinks: {
              where: { isPrimary: true },
              take: 1,
              select: {
                parent: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    relationship: true,
                    familyName: true,
                    _count: { select: { studentLinks: true } },
                  },
                },
              },
            },
          },
        },
        payments: {
          select: { id: true, amount: true, method: true, receiptNumber: true, paidAt: true },
          orderBy: { paidAt: "asc" },
        },
      },
    }),
    loadDueRule(schoolId),
  ]);

  const rows: FeeRow[] = fees
    .map((f) => {
      const totalPaid = f.payments.reduce((sum, p) => sum + p.amount, 0);
      // Statut et retard selon le jour limite et la tolérance de l'école.
      const dueDate = effectiveDueDate(f, dueRule);
      const amounts = { amount: f.amount, totalPaid, dueDate };
      const linked = f.student.parentLinks[0]?.parent ?? null;
      const parent = linked
        ? {
            id: linked.id,
            firstName: linked.firstName,
            lastName: linked.lastName,
            phone: linked.phone,
            relationship: linked.relationship,
            familyName: linked.familyName,
            familySize: linked._count.studentLinks,
          }
        : null;
      return {
        id: f.id,
        label: f.label,
        amount: f.amount,
        // L'échéance annoncée : le jour limite de l'école.
        dueDate: payByDate(f, dueRule).toISOString(),
        totalPaid,
        remaining: remainingOf(amounts),
        tuitionPlanId: f.tuitionPlanId,
        isDue: dueDate <= now,
        status: feeDisplayStatus(amounts, now),
        overdueDays: daysOverdue(amounts, now),
        student: {
          id: f.student.id,
          firstName: f.student.firstName,
          lastName: f.student.lastName,
          photoUrl: null,
          classId: f.student.classId,
          className: f.student.classRoom?.name ?? null,
        },
        parent,
        payments: f.payments.map((p) => ({
          id: p.id,
          receiptNumber: p.receiptNumber,
          amount: p.amount,
          method: p.method,
          paidAt: p.paidAt.toISOString(),
        })),
      };
    })
    // Les mouvements les plus récents en tête : dernier paiement reçu, ou
    // échéance pour un frais encore sans versement. Les échéances à venir,
    // jamais payées, passent en dessous, de la plus proche à la plus
    // lointaine : en tête, juin 2027 faisait encaisser juin avant octobre.
    .sort((a, b) => {
      const upcomingA = !a.isDue && a.payments.length === 0;
      const upcomingB = !b.isDue && b.payments.length === 0;
      if (upcomingA !== upcomingB) return upcomingA ? 1 : -1;
      if (upcomingA) return a.dueDate.localeCompare(b.dueDate);
      return feeListDay(b).localeCompare(feeListDay(a));
    });

  // — Tuiles : argent reçu mois par mois sur six mois, et recouvrement global.
  const months = lastMonthKeys(now, 6);
  const payments = fees.flatMap((f) => f.payments);
  const collectedByMonth = monthlySums(
    payments.map((p) => ({ at: p.paidAt, amount: p.amount })),
    months,
  );
  const paymentsByMonth = months.map((key) => payments.filter((p) => isInMonth(p.paidAt, key)).length);
  const billed = rows.reduce((sum, r) => sum + r.amount, 0);
  const collected = rows.reduce((sum, r) => sum + r.totalPaid, 0);
  const last = months.length - 1;

  const kpis: PaymentsKpis = {
    collected,
    collectedByMonth,
    collectedChange: percentChange(collectedByMonth[last] ?? 0, collectedByMonth[last - 1] ?? 0),
    // Reste dû : les échéances arrivées seulement. Les mois à venir d'une
    // formule de paiement ne sont pas encore dus.
    outstanding: rows.filter((r) => r.isDue).reduce((sum, r) => sum + r.remaining, 0),
    lateCount: rows.filter((r) => r.overdueDays > 0).length,
    paymentCount: payments.length,
    paymentsByMonth,
    billed,
    rate: collectionRate(billed, collected),
  };

  return { rows, kpis };
}

/** Ajoute les photos des élèves des lignes données (la page affichée). */
export async function withPhotos(schoolId: string, rows: FeeRow[]): Promise<FeeRow[]> {
  const ids = [...new Set(rows.map((r) => r.student.id))];
  if (ids.length === 0) return rows;
  const photos = await prisma.student.findMany({
    where: { schoolId, id: { in: ids }, photoUrl: { not: null } },
    select: { id: true, photoUrl: true },
  });
  const byId = new Map(photos.map((p) => [p.id, p.photoUrl]));
  return rows.map((r) => ({ ...r, student: { ...r.student, photoUrl: byId.get(r.student.id) ?? null } }));
}

/**
 * Pour la fenêtre « Enregistrer un paiement » : les frais encore dus, sans
 * historique ni parent (inutiles à la saisie). D'un élève, ou de toute l'école.
 */
export function openFeesOf(rows: FeeRow[], studentId?: string): FeeRow[] {
  return rows
    .filter((r) => r.remaining > 0 && (!studentId || r.student.id === studentId))
    .map((r) => ({ ...r, parent: null, payments: [] }));
}
