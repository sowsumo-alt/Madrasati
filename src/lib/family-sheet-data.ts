import type { Prisma, PrismaClient } from "@prisma/client";
import { monthLabel, monthStart } from "@/lib/tuition";
import { applyTuitionPlan, recordGroupedPayment, type PaymentPart } from "@/lib/tuition-plan";
import { sheetErrors, todayIso, type FamilySheetInput, type SheetAlready } from "@/lib/family-sheet";
import { UserError } from "@/lib/user-error";
import { FICHE_MODE_LABELS, type FicheMode } from "@/lib/family-fiche";

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
  // Fiche familiale : l'inscription est portée par le même élève référent que
  // les mois — un seul référent, sur la page famille comme sur le reçu.
  if (fee && familyParentId && fee.studentId !== studentId) {
    await tx.fee.update({ where: { id: fee.id }, data: { studentId, familyParentId } });
    await tx.payment.updateMany({ where: { feeId: fee.id }, data: { studentId } });
    fee = { ...fee, studentId };
  }
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
 * L'élève référent de la fiche familiale : celui qui porte la fiche de
 * l'année en forfait (ses mois, sinon l'inscription de la famille), sinon
 * celui que le directeur a choisi (mode par enfant). La seule définition, lue
 * par la page famille, la fiche et le reçu.
 */
export async function familyReferentId(db: Db, parentId: string): Promise<string | null> {
  const plan = await db.tuitionPlan.findFirst({
    where: { familyParentId: parentId, academicYear: { isCurrent: true } },
    select: { studentId: true },
  });
  if (plan) return plan.studentId;
  const fee = await db.fee.findFirst({
    where: { familyParentId: parentId, academicYear: { isCurrent: true } },
    orderBy: { createdAt: "asc" },
    select: { studentId: true },
  });
  if (fee) return fee.studentId;
  const parent = await db.parent.findUnique({
    where: { id: parentId },
    select: { referentStudentId: true, studentLinks: { select: { studentId: true } } },
  });
  const chosen = parent?.referentStudentId;
  return chosen && parent.studentLinks.some((l) => l.studentId === chosen) ? chosen : null;
}

/** Les montants d'une fiche : les échéances d'une formule et les frais d'inscription. */
const SHEET_FEES = { OR: [{ tuitionPlanId: { not: null } }, { label: { startsWith: "Frais d'inscription" } }] };

export interface FamilyFicheState {
  /** Comment la famille est facturée cette année d'après ce qui est enregistré ; null : rien encore. */
  mode: FicheMode | null;
  /** Forfait : l'enfant qui porte la fiche. */
  holderId: string | null;
  /** Des paiements sont déjà enregistrés sur ces montants. */
  hasPayments: boolean;
}

export async function familyFicheState(
  db: Db,
  input: { parentId: string; yearId: string; childIds: string[] },
): Promise<FamilyFicheState> {
  const familyFees = await db.fee.findMany({
    where: { familyParentId: input.parentId, academicYearId: input.yearId },
    select: { studentId: true, tuitionPlanId: true, _count: { select: { payments: true } } },
  });
  const familyPlan = await db.tuitionPlan.findFirst({
    where: { familyParentId: input.parentId, academicYearId: input.yearId },
    select: { studentId: true },
  });
  if (familyPlan || familyFees.length > 0) {
    return {
      mode: "FAMILY",
      holderId: familyPlan?.studentId ?? familyFees[0].studentId,
      hasPayments: familyFees.some((f) => f._count.payments > 0),
    };
  }
  if (input.childIds.length < 2) return { mode: null, holderId: null, hasPayments: false };
  const own = await db.fee.findMany({
    where: { studentId: { in: input.childIds }, academicYearId: input.yearId, familyParentId: null, ...SHEET_FEES },
    select: { _count: { select: { payments: true } } },
  });
  return {
    mode: own.length > 0 ? "PER_CHILD" : null,
    holderId: null,
    hasPayments: own.some((f) => f._count.payments > 0),
  };
}

/**
 * Avant d'enregistrer la fiche d'une famille : la façon de facturer choisie
 * et l'élève référent. Changer de façon de facturer est refusé dès que de
 * l'argent a été encaissé sur l'autre (on ne déplace pas des paiements) ;
 * sans paiement, les échéances de l'ancienne façon sont reprises ou retirées.
 * En forfait, un nouveau référent reçoit la fiche (échéances, inscription et
 * paiements, ensemble) — aucun montant ne change.
 */
export async function prepareFamilyFiche(
  tx: Prisma.TransactionClient,
  input: { parentId: string; yearId: string; childIds: string[]; mode: FicheMode; referentId: string },
) {
  const { parentId, yearId, childIds, mode, referentId } = input;
  const state = await familyFicheState(tx, { parentId, yearId, childIds });
  if (state.mode && state.mode !== mode && state.hasPayments) {
    throw new UserError(
      `Des paiements sont déjà enregistrés en « ${FICHE_MODE_LABELS[state.mode]} » : la façon de facturer ne peut plus changer. Annulez d'abord ces paiements.`,
    );
  }

  if (mode === "PER_CHILD" && state.mode === "FAMILY") {
    // Sans paiement : la fiche familiale devient celle de l'enfant qui la portait.
    await tx.tuitionPlan.updateMany({ where: { familyParentId: parentId, academicYearId: yearId }, data: { familyParentId: null } });
    await tx.fee.updateMany({ where: { familyParentId: parentId, academicYearId: yearId }, data: { familyParentId: null } });
  }
  if (mode === "FAMILY" && state.mode === "PER_CHILD") {
    // Sans paiement : les échéances propres des autres enfants disparaissent ;
    // celles du référent deviennent celles de la famille.
    const others = childIds.filter((id) => id !== referentId);
    await tx.fee.deleteMany({
      where: { studentId: { in: others }, academicYearId: yearId, familyParentId: null, payments: { none: {} }, ...SHEET_FEES },
    });
    await tx.tuitionPlan.deleteMany({ where: { studentId: { in: others }, academicYearId: yearId, familyParentId: null, fees: { none: {} } } });
  }
  if (mode === "FAMILY" && state.mode === "FAMILY" && state.holderId && state.holderId !== referentId) {
    await moveFamilyFiche(tx, { parentId, yearId, from: state.holderId, to: referentId });
  }
  await tx.parent.update({ where: { id: parentId }, data: { referentStudentId: referentId } });
}

/** La fiche familiale passe à un autre enfant : échéances, formule, inscription et paiements. */
async function moveFamilyFiche(
  tx: Prisma.TransactionClient,
  input: { parentId: string; yearId: string; from: string; to: string },
) {
  const { parentId, yearId, from, to } = input;
  // Ce que le nouveau référent avait à son nom pour l'année : sans paiement, retiré ; payé, on n'écrase rien.
  const own = await tx.fee.findMany({
    where: { studentId: to, academicYearId: yearId, familyParentId: null, ...SHEET_FEES },
    select: { id: true, _count: { select: { payments: true } } },
  });
  if (own.some((f) => f._count.payments > 0)) {
    const student = await tx.student.findUnique({ where: { id: to }, select: { firstName: true, lastName: true } });
    throw new UserError(
      `${student ? `${student.firstName} ${student.lastName}`.trim() : "Cet enfant"} a déjà ses propres paiements cette année : il ne peut pas devenir l'élève référent de la fiche familiale.`,
    );
  }
  await tx.fee.deleteMany({ where: { id: { in: own.map((f) => f.id) } } });
  await tx.tuitionPlan.deleteMany({ where: { studentId: to, academicYearId: yearId, familyParentId: null } });

  await tx.tuitionPlan.updateMany({ where: { familyParentId: parentId, academicYearId: yearId, studentId: from }, data: { studentId: to } });
  const fees = await tx.fee.findMany({ where: { familyParentId: parentId, academicYearId: yearId, studentId: from }, select: { id: true } });
  const feeIds = fees.map((f) => f.id);
  await tx.fee.updateMany({ where: { id: { in: feeIds } }, data: { studentId: to } });
  await tx.payment.updateMany({ where: { feeId: { in: feeIds } }, data: { studentId: to } });
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
