import type { Prisma, PrismaClient } from "@prisma/client";
import { monthLabel, monthStart } from "@/lib/tuition";
import { applyTuitionPlan, type PaymentPart } from "@/lib/tuition-plan";
import { sheetErrors, type FamilySheetInput } from "@/lib/family-sheet";

/**
 * Enregistrement d'une fiche de paiement familiale (voir lib/family-sheet.ts).
 *
 * Les montants de la fiche sont rattachés à UN élève, le référent — comme la
 * fiche papier, qui porte le nom d'un seul enfant — et marqués comme
 * appartenant à la famille (familyParentId). Rien n'est créé pour les autres
 * enfants : aucun montant n'est dupliqué, et la famille compte une seule
 * fois au tableau de bord, dans les impayés et dans l'argent perçu.
 */

type Db = Prisma.TransactionClient | PrismaClient;

/**
 * Crée l'inscription et les échéances mensuelles de la fiche, et renvoie les
 * parts à encaisser aujourd'hui (un mois versé = une part, l'inscription =
 * une part). Le règlement lui-même — un seul reçu — est fait par l'appelant.
 */
export async function recordFamilySheet(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    year: { id: string; label: string; startDate: Date; endDate: Date };
    /** La famille, pour une fiche familiale ; null pour une fiche d'un seul enfant. */
    familyParentId: string | null;
    referentStudentId: string;
    sheet: FamilySheetInput;
    /** Premier mois facturé (le mois de l'inscription). */
    firstMonth: Date;
    now: Date;
  },
): Promise<PaymentPart[]> {
  const { schoolId, year, familyParentId, referentStudentId: studentId, sheet, now } = input;
  const errors = sheetErrors(sheet);
  if (errors.length > 0) throw new Error(errors[0]);

  const parts: PaymentPart[] = [];

  // L'inscription : un montant unique pour la fiche, jamais répété ni multiplié.
  if (sheet.enrollment.due > 0) {
    const fee = await tx.fee.create({
      data: {
        schoolId,
        studentId,
        academicYearId: year.id,
        label: `Frais d'inscription — ${year.label}`,
        amount: sheet.enrollment.due,
        dueDate: now,
        status: "PENDING",
        familyParentId,
      },
    });
    if (sheet.enrollment.paid > 0) {
      parts.push({ feeId: fee.id, studentId, amount: sheet.enrollment.paid, feeAmount: fee.amount, paidBefore: 0 });
    }
  }

  // Les mois : une échéance par mois, au montant mensuel saisi.
  if (sheet.monthly > 0) {
    const applied = await applyTuitionPlan(tx, {
      schoolId,
      studentId,
      year,
      frequency: "MONTHLY",
      customMonths: 1,
      monthlyAmount: sheet.monthly,
      firstMonth: input.firstMonth,
    });
    if (familyParentId) {
      await tx.tuitionPlan.update({ where: { id: applied.planId }, data: { familyParentId } });
      await tx.fee.updateMany({ where: { tuitionPlanId: applied.planId }, data: { familyParentId } });
    }
    // Les échéances de la formule, lues une fois.
    const planFees = await tx.fee.findMany({
      where: { tuitionPlanId: applied.planId },
      select: { id: true, amount: true, periodStart: true },
    });
    for (const m of sheet.months.filter((x) => x.paid > 0)) {
      const month = monthStart(new Date(m.month));
      const fee = planFees.find((f) => f.periodStart?.getTime() === month.getTime());
      if (!fee) throw new Error(`${monthLabel(month)} ne fait pas partie des mois facturés de cette fiche.`);
      parts.push({ feeId: fee.id, studentId, amount: m.paid, feeAmount: fee.amount, paidBefore: 0 });
    }
  }

  return parts;
}

/**
 * La famille garde sa dette quoi qu'il arrive à l'élève référent : quand il
 * n'est plus actif (retiré, transféré, non réinscrit…), les montants de la
 * fiche passent à un autre enfant actif de la famille — échéances, formule
 * et paiements, ensemble. Sans autre enfant actif, ils restent où ils sont,
 * toujours marqués comme ceux de la famille, et la fiche famille continue de
 * les compter.
 *
 * Ne change jamais un montant : seul le rattachement bouge.
 */
export async function reattachFamilySheets(db: Db, studentIds: string[]): Promise<number> {
  if (studentIds.length === 0) return 0;
  const leaving = await db.student.findMany({
    where: { id: { in: studentIds }, status: { not: "ACTIVE" } },
    select: { id: true },
  });
  const leavingIds = new Set(leaving.map((s) => s.id));
  if (leavingIds.size === 0) return 0;

  const fees = await db.fee.findMany({
    where: { studentId: { in: [...leavingIds] }, familyParentId: { not: null } },
    select: { id: true, studentId: true, familyParentId: true, tuitionPlanId: true, academicYearId: true },
  });
  let moved = 0;
  const groups = new Map<string, typeof fees>();
  for (const fee of fees) {
    const key = `${fee.familyParentId}|${fee.studentId}`;
    groups.set(key, [...(groups.get(key) ?? []), fee]);
  }

  for (const [key, group] of groups) {
    const [familyParentId, fromStudentId] = key.split("|");
    const candidates = await db.studentParent.findMany({
      where: { parentId: familyParentId, student: { status: "ACTIVE", id: { notIn: [...leavingIds] } } },
      select: { student: { select: { id: true, firstName: true } } },
    });
    const next = candidates.map((c) => c.student).sort((a, b) => a.firstName.localeCompare(b.firstName, "fr"))[0];
    if (!next) continue;

    // La formule suit l'élève : impossible si le nouvel enfant en a déjà une
    // pour cette année (fiche « par enfant ») — on n'écrase rien.
    const planIds = [...new Set(group.map((f) => f.tuitionPlanId).filter((id): id is string => Boolean(id)))];
    if (planIds.length > 0) {
      const years = [...new Set(group.map((f) => f.academicYearId))];
      const clash = await db.tuitionPlan.count({ where: { studentId: next.id, academicYearId: { in: years } } });
      if (clash > 0) continue;
      await db.tuitionPlan.updateMany({ where: { id: { in: planIds }, studentId: fromStudentId }, data: { studentId: next.id } });
    }
    const feeIds = group.map((f) => f.id);
    await db.fee.updateMany({ where: { id: { in: feeIds } }, data: { studentId: next.id } });
    await db.payment.updateMany({ where: { feeId: { in: feeIds } }, data: { studentId: next.id } });
    moved += feeIds.length;
  }
  return moved;
}
