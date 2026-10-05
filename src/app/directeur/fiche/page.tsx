import { notFound, redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { familyLabel } from "@/lib/family";
import { loadTuitionSettings } from "@/lib/tuition-data";
import { monthStart, monthsBetween } from "@/lib/tuition";
import { FICHE_MODE_LABELS, newFicheDraft, type FicheMode } from "@/lib/family-fiche";
import type { SheetChild, SheetExisting } from "@/app/directeur/familles/inscription/family-sheet-step";
import { familyFicheState, familyReferentId } from "@/lib/family-sheet-data";
import { SheetEditor } from "./sheet-editor";

const day = (d: Date) => d.toISOString().slice(0, 10);

const PLAN_SELECT = {
  monthlyAmount: true,
  firstMonth: true,
  fees: {
    select: {
      amount: true,
      label: true,
      periodStart: true,
      periodEnd: true,
      payments: { select: { amount: true, paidAt: true } },
    },
  },
} satisfies Prisma.TuitionPlanSelect;
type Plan = Prisma.TuitionPlanGetPayload<{ select: typeof PLAN_SELECT }>;
type EnrollmentFee = { amount: number; payments: { amount: number; paidAt: Date }[] };

/** Ce qu'une fiche (une formule et une inscription) a déjà reçu, mois par mois. */
function existingOf(plan: Plan | null, enrollment: EnrollmentFee | null): SheetExisting {
  const existing: SheetExisting = { already: { months: {}, enrollment: null }, paidDates: {}, locked: {}, enrollmentDates: [] };
  for (const fee of plan?.fees ?? []) {
    if (!fee.periodStart || fee.payments.length === 0) continue;
    const paid = fee.payments.reduce((sum, p) => sum + p.amount, 0);
    const months = monthsBetween(fee.periodStart, fee.periodEnd ?? fee.periodStart).map((m) => m.toISOString());
    const dates = [...new Set(fee.payments.map((p) => day(p.paidAt)))].sort();
    if (months.length > 1) {
      // Une échéance de plusieurs mois déjà entamée : ses mois ne se règlent pas ici.
      for (const m of months) existing.locked[m] = fee.label;
    } else {
      existing.already.months[months[0]] = { due: fee.amount, paid };
      existing.paidDates[months[0]] = dates;
    }
  }
  if (enrollment) {
    existing.already.enrollment = { due: enrollment.amount, paid: enrollment.payments.reduce((sum, p) => sum + p.amount, 0) };
    existing.enrollmentDates = [...new Set(enrollment.payments.map((p) => day(p.paidAt)))].sort();
  }
  return existing;
}

/**
 * Fiche de paiement d'une famille (?famille=…) ou d'un élève (?eleve=…) déjà
 * inscrits : la reprise des fiches papier, ou une correction. Tous les
 * enfants actifs y figurent — un enfant ajouté plus tard y arrive « à
 * saisir » —, forfait famille ou montant par enfant ; la page relit ce que
 * chaque enfant (ou la famille) a déjà reçu.
 */
export default async function SheetPage({
  searchParams,
}: {
  searchParams: Promise<{ famille?: string; eleve?: string }>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const { famille, eleve } = await searchParams;
  const settings = await loadTuitionSettings(user.schoolId);
  const year = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isCurrent: true },
    select: { id: true },
  });

  const studentSelect = {
    id: true,
    firstName: true,
    lastName: true,
    classId: true,
    rimNumber: true,
    enrollmentDate: true,
    status: true,
    classRoom: { select: { id: true, name: true } },
  } satisfies Prisma.StudentSelect;

  let parentId: string | null = null;
  let title: string;
  let backHref: string;
  let students: Prisma.StudentGetPayload<{ select: typeof studentSelect }>[];

  if (famille) {
    const parent = await prisma.parent.findFirst({
      where: { id: famille, schoolId: user.schoolId },
      include: {
        studentLinks: {
          where: { student: { status: "ACTIVE" } },
          orderBy: { student: { createdAt: "asc" } },
          select: { student: { select: studentSelect } },
        },
      },
    });
    if (!parent) notFound();
    parentId = parent.id;
    title = familyLabel(parent, "Famille {name}");
    backHref = `/directeur/familles/${parent.id}`;
    students = parent.studentLinks.map((l) => l.student);
  } else if (eleve) {
    const student = await prisma.student.findFirst({
      where: { id: eleve, schoolId: user.schoolId },
      select: {
        ...studentSelect,
        parentLinks: {
          where: { isPrimary: true },
          select: { parentId: true, parent: { select: { studentLinks: { where: { student: { status: "ACTIVE" } }, select: { studentId: true } } } } },
        },
      },
    });
    if (!student) notFound();
    // Un enfant d'une famille de plusieurs élèves : sa fiche est celle de la famille.
    const family = student.parentLinks[0];
    if (family && family.parent.studentLinks.length >= 2) redirect(`/directeur/fiche?famille=${family.parentId}`);
    title = `${student.firstName} ${student.lastName}`.trim();
    backHref = family ? `/directeur/familles/${family.parentId}` : "/directeur/eleves";
    students = [student];
  } else {
    notFound();
  }
  if (students.length === 0) notFound();

  const childIds = students.map((s) => s.id);
  const multi = Boolean(parentId) && students.length >= 2;
  const state =
    multi && parentId && year
      ? await familyFicheState(prisma, { parentId, yearId: year.id, childIds })
      : { mode: null, holderId: null, hasPayments: false };
  const mode: FicheMode = multi ? (state.mode ?? settings.familySheetMode) : "FAMILY";
  const chosen = multi && parentId ? await familyReferentId(prisma, parentId) : null;
  const referentKey = childIds.includes(chosen ?? "") ? chosen! : childIds[0];

  // Ce qui est enregistré pour l'année : la fiche de la famille (forfait), et
  // celle de chaque enfant (sa formule, son inscription).
  const [familyPlan, familyEnrollment, ownPlans, ownEnrollments] = year
    ? await Promise.all([
        parentId
          ? prisma.tuitionPlan.findFirst({ where: { familyParentId: parentId, academicYearId: year.id }, select: PLAN_SELECT })
          : null,
        parentId
          ? prisma.fee.findFirst({
              where: { familyParentId: parentId, academicYearId: year.id, tuitionPlanId: null, label: { startsWith: "Frais d'inscription" } },
              orderBy: { createdAt: "asc" },
              select: { amount: true, payments: { select: { amount: true, paidAt: true } } },
            })
          : null,
        prisma.tuitionPlan.findMany({
          where: { studentId: { in: childIds }, academicYearId: year.id, familyParentId: null },
          select: { studentId: true, ...PLAN_SELECT },
        }),
        prisma.fee.findMany({
          where: {
            studentId: { in: childIds },
            academicYearId: year.id,
            familyParentId: null,
            tuitionPlanId: null,
            label: { startsWith: "Frais d'inscription" },
          },
          orderBy: { createdAt: "asc" },
          select: { studentId: true, amount: true, payments: { select: { amount: true, paidAt: true } } },
        }),
      ])
    : [null, null, [], []];

  const familyExisting = familyPlan || familyEnrollment ? existingOf(familyPlan, familyEnrollment) : null;
  const childExisting: Record<string, SheetExisting> = {};
  const known: Record<string, { monthly?: number | null; enrollment?: number | null }> = {};
  for (const id of childIds) {
    const plan = ownPlans.find((p) => p.studentId === id) ?? null;
    const enrollment = ownEnrollments.find((f) => f.studentId === id) ?? null;
    if (plan || enrollment) {
      childExisting[id] = existingOf(plan, enrollment);
      known[id] = { monthly: plan?.monthlyAmount ?? null, enrollment: enrollment?.amount ?? null };
    }
  }
  if (familyPlan || familyEnrollment) {
    known[referentKey] = { monthly: familyPlan?.monthlyAmount ?? null, enrollment: familyEnrollment?.amount ?? null };
  }

  // Premier mois facturé : celui d'une formule existante, sinon le mois
  // d'inscription du référent, ramené dans l'année (modifiable sur la fiche).
  const plans = [familyPlan, ...ownPlans].filter((p): p is Plan => Boolean(p));
  const referent = students.find((s) => s.id === referentKey) ?? students[0];
  const months = settings.yearMonths;
  const enrolled = monthStart(referent.enrollmentDate ?? new Date()).toISOString();
  const fromEnrollment =
    months.length === 0 ? undefined : enrolled < months[0] ? months[0] : enrolled > months[months.length - 1] ? months[months.length - 1] : enrolled;
  const firstMonth = plans.length
    ? plans.map((p) => monthStart(p.firstMonth).toISOString()).sort()[0]
    : fromEnrollment;

  const draft = newFicheDraft({
    mode,
    referentKey,
    keys: childIds,
    unit: settings.amountUnit,
    // Rien d'enregistré : le montant d'un mois des Paramètres, proposé au référent.
    monthlyMru: Object.keys(known).length ? null : settings.monthly,
    prepaid: [],
    firstMonth,
    known,
  });

  const entries: SheetChild[] = students.map((s) => ({
    key: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    classId: s.classId ?? "",
    rimNumber: s.rimNumber ?? "",
  }));
  const classes = [...new Map(students.filter((s) => s.classRoom).map((s) => [s.classRoom!.id, s.classRoom!])).values()];
  const modeLock =
    multi && state.mode && state.hasPayments
      ? `Des paiements sont déjà enregistrés en « ${FICHE_MODE_LABELS[state.mode]} » : la façon de facturer ne change plus (annulez d'abord ces paiements pour en changer).`
      : null;

  return (
    <SheetEditor
      title={title}
      backHref={backHref}
      parentId={parentId}
      entries={entries}
      classes={classes}
      settings={settings}
      studentCount={students.length}
      initialDraft={draft}
      familyExisting={familyExisting}
      childExisting={childExisting}
      modeLock={modeLock}
      draftKey={`fiche-${user.schoolId}-${parentId ?? eleve}`}
    />
  );
}
