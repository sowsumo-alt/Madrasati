import type { Prisma, PrismaClient } from "@prisma/client";
import { monthLabel, monthStart } from "@/lib/tuition";
import { applyTuitionPlan, recordGroupedPayment, type PaymentPart } from "@/lib/tuition-plan";
import { sheetErrors, todayIso, type FamilySheetInput, type SheetAlready } from "@/lib/family-sheet";
import { UserError } from "@/lib/user-error";

/**
 * Enregistrement d'une fiche de paiement (voir lib/family-sheet.ts) : à
 * l'inscription d'une famille ou d'un élève seul, ou plus tard, depuis la
 * page de la famille ou de l'élève (reprise des fiches papier).
 *
 * Les montants d'une fiche familiale sont rattachés à UN élève, le référent —
 * comme la fiche papier, qui porte le nom d'un seul enfant — et marqués comme
 * appartenant à la famille (familyParentId). Rien n'est créé pour les autres
 * enfants : aucun montant n'est dupliqué, et la famille compte une seule
 * fois au tableau de bord, dans les impayés et dans l'argent perçu.
 */

type Db = Prisma.TransactionClient | PrismaClient;

/** Une part à encaisser, avec la date de son versement (null : aujourd'hui). */
export type DatedPart = PaymentPart & { date: string | null };

const studentName = (s: { firstName: string; lastName: string }) => `${s.firstName} ${s.lastName}`.trim();

/**
 * Crée (ou met à jour) l'inscription et les échéances mensuelles de la
 * fiche, et renvoie les parts à encaisser, chacune à sa date. Le règlement
 * lui-même est fait par recordSheetPayments.
 *
 * Fiche déjà saisie : ce que chaque ligne a déjà reçu est relu ici, en base ;
 * l'inscription existante est reprise, jamais créée une seconde fois ; les
 * mois déjà réglés restent tels quels avec leurs reçus (applyTuitionPlan).
 */
export async function recordFamilySheet(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    year: { id: string; label: string; startDate: Date; endDate: Date };
    /** La famille, pour une fiche familiale ; null pour la fiche d'un seul enfant. */
    familyParentId: string | null;
    referentStudentId: string;
    sheet: FamilySheetInput;
    /** Premier mois facturé, quand la fiche n'en précise pas (le mois de l'inscription). */
    firstMonth: Date;
    now: Date;
  },
): Promise<DatedPart[]> {
  const { schoolId, year, familyParentId, referentStudentId: studentId, sheet, now } = input;
  const today = todayIso(now);
  const hasAmounts = sheet.monthly > 0 || sheet.enrollment.due > 0;

  // — Une seule fiche par famille et par année : pas de seconde fiche sur un
  // autre enfant, ni d'échéances qu'un enfant aurait déjà de son côté.
  if (familyParentId && hasAmounts) {
    const other = await tx.tuitionPlan.findFirst({
      where: { familyParentId, academicYearId: year.id, studentId: { not: studentId } },
      select: { student: { select: { firstName: true, lastName: true } } },
    });
    if (other) {
      throw new UserError(
        `Cette famille a déjà sa fiche de paiement (élève référent : ${studentName(other.student)}). Modifiez-la depuis la page de la famille.`,
      );
    }
    const own = await tx.tuitionPlan.findFirst({
      where: {
        academicYearId: year.id,
        familyParentId: null,
        studentId: { not: studentId },
        student: { status: "ACTIVE", parentLinks: { some: { parentId: familyParentId } } },
        fees: { some: {} },
      },
      select: { student: { select: { firstName: true, lastName: true } } },
    });
    if (own) {
      throw new UserError(
        `${studentName(own.student)} a déjà ses propres échéances cette année : la fiche familiale les compterait deux fois. Choisissez cet enfant comme élève référent, ou retirez d'abord ses échéances.`,
      );
    }
  }

  // — L'inscription : un montant unique pour la fiche, jamais répété ni
  // multiplié. Déjà enregistrée : reprise, son montant suit la fiche.
  const enrollmentFee = await tx.fee.findFirst({
    where: {
      schoolId,
      academicYearId: year.id,
      tuitionPlanId: null,
      label: { startsWith: "Frais d'inscription" },
      ...(familyParentId ? { OR: [{ familyParentId }, { studentId, familyParentId: null }] } : { studentId }),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, amount: true, studentId: true, payments: { select: { amount: true } } },
  });
  const enrollmentBefore = enrollmentFee?.payments.reduce((sum, p) => sum + p.amount, 0) ?? 0;

  // — Les mois : une échéance par mois, au montant mensuel saisi.
  let planId: string | null = null;
  if (sheet.monthly > 0) {
    const applied = await applyTuitionPlan(tx, {
      schoolId,
      studentId,
      year,
      frequency: "MONTHLY",
      customMonths: 1,
      monthlyAmount: sheet.monthly,
      firstMonth: sheet.firstMonth ? new Date(sheet.firstMonth) : input.firstMonth,
    });
    planId = applied.planId;
  } else if (sheet.months.some((m) => m.paid > 0)) {
    planId =
      (
        await tx.tuitionPlan.findUnique({
          where: { studentId_academicYearId: { studentId, academicYearId: year.id } },
          select: { id: true },
        })
      )?.id ?? null;
  }
  if (planId && familyParentId) {
    await tx.tuitionPlan.update({ where: { id: planId }, data: { familyParentId } });
    await tx.fee.updateMany({ where: { tuitionPlanId: planId }, data: { familyParentId } });
  }
  // Les échéances de la formule et ce qu'elles ont reçu, lues une fois.
  const planFees = planId
    ? await tx.fee.findMany({
        where: { tuitionPlanId: planId },
        select: { id: true, amount: true, periodStart: true, periodEnd: true, payments: { select: { amount: true } } },
      })
    : [];
  const paidOf = (fee: { payments: { amount: number }[] }) => fee.payments.reduce((sum, p) => sum + p.amount, 0);

  // Ce que la fiche a déjà reçu, relu en base : le contrôle porte sur le vrai reste dû.
  const already: SheetAlready = {
    months: Object.fromEntries(
      planFees
        .filter((f) => f.periodStart && f.payments.length > 0)
        .map((f) => [f.periodStart!.toISOString(), { due: f.amount, paid: paidOf(f) }]),
    ),
    enrollment: enrollmentFee ? { due: enrollmentFee.amount, paid: enrollmentBefore } : null,
  };
  const errors = sheetErrors({ ...sheet, already }, today);
  if (errors.length > 0) throw new UserError(errors[0]);

  const parts: DatedPart[] = [];
  const dateOf = (date: string | undefined) => (date && date !== today ? date : null);

  let fee = enrollmentFee;
  if (!fee && sheet.enrollment.due > 0) {
    fee = await tx.fee.create({
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
      select: { id: true, amount: true, studentId: true, payments: { select: { amount: true } } },
    });
  } else if (fee && sheet.enrollment.due > 0 && sheet.enrollment.due !== fee.amount) {
    // Montant corrigé (erreur de recopie) : le statut suit le nouveau montant.
    const due = sheet.enrollment.due;
    await tx.fee.update({
      where: { id: fee.id },
      data: { amount: due, status: enrollmentBefore >= due ? "PAID" : enrollmentBefore > 0 ? "PARTIAL" : "PENDING" },
    });
    fee = { ...fee, amount: due };
  }
  if (fee && sheet.enrollment.paid > 0) {
    parts.push({
      feeId: fee.id,
      studentId: fee.studentId,
      amount: sheet.enrollment.paid,
      feeAmount: fee.amount,
      paidBefore: enrollmentBefore,
      date: dateOf(sheet.enrollment.date),
    });
  }

  for (const m of sheet.months.filter((x) => x.paid > 0)) {
    const month = monthStart(new Date(m.month));
    const monthFee = planFees.find((f) => f.periodStart?.getTime() === month.getTime());
    if (!monthFee) throw new UserError(`${monthLabel(month)} ne fait pas partie des mois facturés de cette fiche.`);
    if (monthFee.periodEnd && monthStart(monthFee.periodEnd).getTime() !== month.getTime()) {
      throw new UserError(`${monthLabel(month)} fait partie d'une échéance de plusieurs mois : encaissez-la depuis Finance.`);
    }
    parts.push({
      feeId: monthFee.id,
      studentId,
      amount: m.paid,
      feeAmount: monthFee.amount,
      paidBefore: paidOf(monthFee),
      date: dateOf(m.date),
    });
  }

  return parts;
}

/**
 * Le règlement d'une ou plusieurs fiches : un reçu par date de versement —
 * comme les lignes signées de la fiche papier. Ce qui est versé aujourd'hui
 * prend l'heure de l'encaissement ; une date passée (reprise de l'existant)
 * est gardée telle quelle et compte dans l'argent perçu à cette date.
 */
export async function recordSheetPayments(
  tx: Prisma.TransactionClient,
  input: {
    schoolId: string;
    parts: DatedPart[];
    method: string;
    userId: string;
    attempt: number;
    now: Date;
    parentId?: string | null;
    /** Reçu « famille », même pour une seule ligne. */
    forceGroup?: boolean;
    note?: string | null;
  },
): Promise<{ groupId: string | null; firstPaymentId: string | null; date: string | null }[]> {
  const byDate = new Map<string, DatedPart[]>();
  for (const part of input.parts.filter((p) => p.amount > 0)) {
    const key = part.date ?? "";
    byDate.set(key, [...(byDate.get(key) ?? []), part]);
  }
  // Les dates passées d'abord, aujourd'hui en dernier : les numéros suivent le temps.
  const keys = [...byDate.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  const receipts: { groupId: string | null; firstPaymentId: string | null; date: string | null }[] = [];
  for (const key of keys) {
    const paid = await recordGroupedPayment(tx, {
      schoolId: input.schoolId,
      parts: byDate.get(key)!,
      method: input.method,
      userId: input.userId,
      attempt: input.attempt,
      paidAt: key ? new Date(`${key}T12:00:00Z`) : input.now,
      note: input.note,
      parentId: input.parentId,
      forceGroup: input.forceGroup,
    });
    receipts.push({ ...paid, date: key || null });
  }
  return receipts;
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
