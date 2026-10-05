import { notFound, redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { familyLabel } from "@/lib/family";
import { loadTuitionSettings } from "@/lib/tuition-data";
import { monthStart, monthsBetween } from "@/lib/tuition";
import { newSheetDraft } from "@/lib/family-sheet-draft";
import type { SheetChild, SheetExisting } from "@/app/directeur/familles/inscription/family-sheet-step";
import { SheetEditor } from "./sheet-editor";
import { familyReferentId } from "@/lib/family-sheet-data";

const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Fiche de paiement d'une famille (?famille=…) ou d'un élève (?eleve=…) déjà
 * inscrits : la reprise des fiches papier, ou une correction. La page relit
 * ce que chaque fiche a déjà reçu ; le formulaire est celui de l'inscription.
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
    if (family && family.parent.studentLinks.length >= 2 && settings.familySheetMode === "FAMILY") {
      redirect(`/directeur/fiche?famille=${family.parentId}`);
    }
    title = `${student.firstName} ${student.lastName}`.trim();
    backHref = family ? `/directeur/familles/${family.parentId}` : "/directeur/eleves";
    students = [student];
  } else {
    notFound();
  }

  const familySheet = Boolean(parentId) && students.length >= 2 && settings.familySheetMode === "FAMILY";

  // L'élève référent d'une fiche familiale : celui qui porte déjà la fiche
  // (familyReferentId, comme la page famille et le reçu), sinon le premier inscrit.
  const referentId = familySheet && parentId ? await familyReferentId(prisma, parentId) : null;
  const familyPlan = referentId ? { studentId: referentId } : null;
  const referents = familySheet
    ? [students.find((s) => s.id === familyPlan?.studentId) ?? students[0]]
    : students;

  const loaded = await Promise.all(
    referents.map(async (referent) => {
      const plan = year
        ? await prisma.tuitionPlan.findUnique({
            where: { studentId_academicYearId: { studentId: referent.id, academicYearId: year.id } },
            select: {
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
            },
          })
        : null;
      const enrollment = year
        ? await prisma.fee.findFirst({
            where: {
              schoolId: user.schoolId,
              academicYearId: year.id,
              tuitionPlanId: null,
              label: { startsWith: "Frais d'inscription" },
              ...(familySheet && parentId
                ? { OR: [{ familyParentId: parentId }, { studentId: referent.id, familyParentId: null }] }
                : { studentId: referent.id }),
            },
            orderBy: { createdAt: "asc" },
            select: { amount: true, payments: { select: { amount: true, paidAt: true } } },
          })
        : null;

      const existing: SheetExisting = {
        already: { months: {}, enrollment: null },
        paidDates: {},
        locked: {},
        enrollmentDates: [],
      };
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
        existing.already.enrollment = {
          due: enrollment.amount,
          paid: enrollment.payments.reduce((sum, p) => sum + p.amount, 0),
        };
        existing.enrollmentDates = [...new Set(enrollment.payments.map((p) => day(p.paidAt)))].sort();
      }

      // Premier mois facturé : celui de la formule existante, sinon le mois
      // d'inscription de l'élève, ramené dans l'année (modifiable sur la fiche).
      const enrolled = monthStart(referent.enrollmentDate ?? new Date()).toISOString();
      const months = settings.yearMonths;
      const fromEnrollment =
        months.length === 0 ? undefined : enrolled < months[0] ? months[0] : enrolled > months[months.length - 1] ? months[months.length - 1] : enrolled;
      const draft = newSheetDraft({
        referentKey: referent.id,
        monthlyMru: plan?.monthlyAmount ?? settings.monthly,
        unit: settings.amountUnit,
        prepaid: [],
        firstMonth: plan ? monthStart(plan.firstMonth).toISOString() : fromEnrollment,
        enrollmentDueMru: enrollment?.amount ?? null,
      });
      return { draft, existing };
    }),
  );

  const children: SheetChild[] = students.map((s) => ({
    key: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    classId: s.classId ?? "",
    rimNumber: s.rimNumber ?? "",
  }));
  const classes = [...new Map(students.filter((s) => s.classRoom).map((s) => [s.classRoom!.id, s.classRoom!])).values()];

  return (
    <SheetEditor
      title={title}
      backHref={backHref}
      parentId={parentId}
      entries={children}
      classes={classes}
      settings={settings}
      studentCount={students.length}
      initialSheets={loaded.map((l) => l.draft)}
      existing={loaded.map((l) => l.existing)}
      lockReferent={Boolean(familyPlan)}
      draftKey={`fiche-${user.schoolId}-${parentId ?? eleve}`}
    />
  );
}
