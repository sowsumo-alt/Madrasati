import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { balanceOf } from "@/lib/money";
import { effectiveDueDate, payByDate, type DueRule } from "@/lib/due-rule";
import { loadSchoolDueRule } from "@/lib/school-cache";

/** La règle d'échéance de l'école (Paramètres) : en cache entre les requêtes (lib/school-cache.ts). */
export const loadDueRule = cache((schoolId: string): Promise<DueRule> => loadSchoolDueRule(schoolId));

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
/**
 * Le nombre d'échéances dues et non soldées (la cloche, sur chaque page du
 * directeur) : même règle que dueFeesOf, mais seulement les colonnes du calcul.
 */
export async function dueFeeCount(schoolId: string, now = new Date()): Promise<number> {
  const [rule, fees] = await Promise.all([
    loadDueRule(schoolId),
    prisma.fee.findMany({
      where: { schoolId, status: { not: "PAID" }, dueDate: { lte: now } },
      select: { amount: true, dueDate: true, periodStart: true, payments: { select: { amount: true } } },
    }),
  ]);
  return fees.filter((f) => {
    const paid = f.payments.reduce((sum, p) => sum + p.amount, 0);
    return balanceOf([{ amount: f.amount, paid, dueDate: effectiveDueDate(f, rule) }], now).due > 0;
  }).length;
}

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
