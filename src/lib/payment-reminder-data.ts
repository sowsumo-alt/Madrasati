import { prisma } from "@/lib/prisma";
import { loadDueRule } from "@/lib/due-rule-data";
import { isAmountUnit, type AmountUnit } from "@/lib/money";
import { reminderGroups, type ReminderGroup } from "@/lib/payment-reminder";
import type { DueRule } from "@/lib/due-rule";

/**
 * Les familles à relancer aujourd'hui : lu par la page « Rappels du mois »
 * et relu par l'action qui note un rappel envoyé — le montant enregistré est
 * celui calculé ici, jamais un chiffre venu du navigateur.
 */
export async function loadReminderGroups(
  schoolId: string,
  now = new Date(),
): Promise<{ groups: ReminderGroup[]; rule: DueRule; schoolName: string; unit: AmountUnit }> {
  const [rule, school, fees, students, parents] = await Promise.all([
    loadDueRule(schoolId),
    prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, amountUnit: true } }),
    // Une échéance n'est jamais due avant sa date enregistrée : premier tri en base.
    prisma.fee.findMany({
      where: { schoolId, status: { not: "PAID" }, dueDate: { lte: now } },
      select: {
        studentId: true,
        label: true,
        amount: true,
        dueDate: true,
        periodStart: true,
        familyParentId: true,
        payments: { select: { amount: true } },
      },
    }),
    prisma.student.findMany({
      where: { schoolId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        classRoom: { select: { name: true } },
        parentLinks: { select: { parentId: true, isPrimary: true } },
      },
    }),
    prisma.parent.findMany({
      where: { schoolId },
      select: { id: true, firstName: true, lastName: true, phone: true },
    }),
  ]);

  const groups = reminderGroups({
    fees: fees.map((f) => ({ ...f, paid: f.payments.reduce((sum, p) => sum + p.amount, 0) })),
    students: students.map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`.trim(),
      className: s.classRoom?.name ?? null,
      active: s.status === "ACTIVE",
      parentId: (s.parentLinks.find((l) => l.isPrimary) ?? s.parentLinks[0])?.parentId ?? null,
    })),
    parents: parents.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`.trim(), phone: p.phone })),
    rule,
    now,
  });
  return {
    groups,
    rule,
    schoolName: school?.name ?? "",
    unit: isAmountUnit(school?.amountUnit) ? school.amountUnit : "MRU",
  };
}
