import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { CURRENT_YEAR } from "@/lib/school-year";
import { loadDueRule } from "@/lib/due-rule-data";
import { effectiveDueDate } from "@/lib/due-rule";
import { monthsBetween } from "@/lib/tuition";
import { classPaymentRows, feeCoversMonth, monthWindow, type MonthFee } from "@/lib/class-payments";
import { ClassPaymentsView, type ClassPaymentsSection } from "./class-payments-view";

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/**
 * Paiements par classe : pour un mois, chaque élève de la classe — payé, en
 * partie, pas encore — avec les totaux. Imprimable, une page par classe.
 */
export default async function ClassPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ classe?: string; mois?: string }>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const params = await searchParams;
  const now = new Date();

  const [classes, year, school, rule] = await Promise.all([
    prisma.classRoom.findMany({
      where: { schoolId: user.schoolId, ...CURRENT_YEAR },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.academicYear.findFirst({
      where: { schoolId: user.schoolId, isCurrent: true },
      select: { startDate: true, endDate: true },
    }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true, amountUnit: true } }),
    loadDueRule(user.schoolId),
  ]);

  // Mois de l'année scolaire ; par défaut le mois en cours (ou le plus proche).
  const months = year ? monthsBetween(year.startDate, year.endDate).map(monthKey) : [monthKey(now)];
  const current = monthKey(now);
  const fallback = months.includes(current) ? current : current < months[0] ? months[0] : months[months.length - 1];
  const window = monthWindow(params.mois && months.includes(params.mois) ? params.mois : fallback)!;

  // « toutes » : chaque classe, une section (et une page imprimée) par classe.
  const all = params.classe === "toutes";
  const selected = all ? classes : classes.filter((c) => c.id === params.classe).slice(0, 1);
  const shown = selected.length > 0 ? selected : classes.slice(0, 1);

  const students = await prisma.student.findMany({
    where: { schoolId: user.schoolId, status: "ACTIVE", classId: { in: shown.map((c) => c.id) } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      matricule: true,
      classId: true,
      parentLinks: { select: { parentId: true } },
    },
  });
  const studentIds = students.map((s) => s.id);
  const parentIds = [...new Set(students.flatMap((s) => s.parentLinks.map((l) => l.parentId)))];

  // Frais qui couvrent le mois : ceux des élèves affichés, et ceux des fiches
  // familiales de leurs parents (portées par un enfant, peut-être d'une autre classe).
  const candidates = studentIds.length
    ? await prisma.fee.findMany({
        where: {
          schoolId: user.schoolId,
          AND: [
            { OR: [{ studentId: { in: studentIds } }, { familyParentId: { in: parentIds } }] },
            {
              OR: [
                {
                  periodStart: { lt: window.end },
                  OR: [{ periodEnd: { gte: window.start } }, { periodEnd: null, periodStart: { gte: window.start } }],
                },
                { periodStart: null, dueDate: { gte: window.start, lt: window.end } },
              ],
            },
          ],
        },
        select: {
          studentId: true,
          familyParentId: true,
          amount: true,
          dueDate: true,
          periodStart: true,
          periodEnd: true,
          payments: { select: { amount: true } },
          student: { select: { firstName: true, lastName: true, classRoom: { select: { name: true } } } },
        },
      })
    : [];
  const fees = candidates.filter((f) => feeCoversMonth(f, window));
  const asMonthFee = (f: (typeof fees)[number]): MonthFee => ({
    amount: f.amount,
    paid: f.payments.reduce((sum, p) => sum + p.amount, 0),
    dueDate: effectiveDueDate(f, rule),
  });

  const sections: ClassPaymentsSection[] = shown.map((c) => {
    const ofClass = students.filter((s) => s.classId === c.id);
    const { rows, totals } = classPaymentRows(
      ofClass.map((s) => {
        const own = fees.filter((f) => f.studentId === s.id);
        const parents = new Set(s.parentLinks.map((l) => l.parentId));
        const familyFees = own.length === 0 ? fees.filter((f) => f.familyParentId && parents.has(f.familyParentId)) : [];
        const holder = familyFees[0]?.student;
        return {
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          matricule: s.matricule,
          fees: own.map(asMonthFee),
          family:
            familyFees.length > 0 && holder
              ? { holder: `${holder.firstName} ${holder.lastName}`.trim(), holderClass: holder.classRoom?.name ?? null, fees: familyFees.map(asMonthFee) }
              : null,
        };
      }),
      now,
    );
    return { classId: c.id, className: c.name, rows, totals };
  });

  return (
    <ClassPaymentsView
      classes={classes}
      classId={all ? "toutes" : (shown[0]?.id ?? "")}
      months={months}
      month={window.key}
      sections={sections}
      schoolName={school?.name ?? "Madrasati"}
      unit={school?.amountUnit === "MRO" ? "MRO" : "MRU"}
    />
  );
}
