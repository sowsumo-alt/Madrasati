import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { balanceOf } from "@/lib/money";
import { dueRuleOf, effectiveDueDate, payByDate, type DueRule } from "@/lib/due-rule";

/** La règle d'échéance de l'école (Paramètres), lue une fois par requête. */
export const loadDueRule = cache(async (schoolId: string): Promise<DueRule> =>
  dueRuleOf(
    await prisma.school.findUnique({
      where: { id: schoolId },
      select: { paymentDueDay: true, paymentGraceDays: true },
    }),
  ),
);

export interface DueFee {
  id: string;
  studentId: string;
  label: string;
  amount: number;
  paid: number;
  /** Reste dû aujourd'hui, toujours > 0. */
  remaining: number;
  /** Moment où la ligne est devenue due (jour limite + tolérance). */
  dueDate: Date;
  /** Jour limite annoncé au parent. */
  payBy: Date;
  periodStart: Date | null;
  familyParentId: string | null;
}

/**
 * Les échéances dues et non soldées de l'école, selon sa règle : la cloche,
 * les notifications, le tableau de bord, les relances. Une échéance n'est
 * jamais due avant sa date enregistrée (la règle ne fait que la repousser),
 * d'où le premier filtre en base.
 */
export async function dueFeesOf(schoolId: string, now = new Date()): Promise<DueFee[]> {
  const [rule, fees] = await Promise.all([
    loadDueRule(schoolId),
    prisma.fee.findMany({
      where: { schoolId, status: { not: "PAID" }, dueDate: { lte: now } },
      select: {
        id: true,
        studentId: true,
        label: true,
        amount: true,
        dueDate: true,
        periodStart: true,
        familyParentId: true,
        payments: { select: { amount: true } },
      },
    }),
  ]);
  return fees
    .map((f) => {
      const paid = f.payments.reduce((sum, p) => sum + p.amount, 0);
      const dueDate = effectiveDueDate(f, rule);
      return {
        id: f.id,
        studentId: f.studentId,
        label: f.label,
        amount: f.amount,
        paid,
        remaining: balanceOf([{ amount: f.amount, paid, dueDate }], now).due,
        dueDate,
        payBy: payByDate(f, rule),
        periodStart: f.periodStart,
        familyParentId: f.familyParentId,
      };
    })
    .filter((f) => f.remaining > 0);
}
