import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { FEATURES, schoolHasFeature } from "@/lib/plans";
import { feeDisplayStatus, remainingOf } from "@/lib/fee-status";
import { collectionRate, daysOverdue, feeListDay } from "@/lib/payments-list";
import { isInMonth, lastMonthKeys, monthlySums, percentChange } from "@/lib/dashboard-data";
import { FinanceView, type FeeRow, type PaymentsKpis } from "./finance-view";

const DEFAULT_REMINDER =
  "Bonjour {parentName},\n\nNous vous rappelons que des frais de scolarité de {amount} MRU concernant {studentName} sont en attente de paiement, avec échéance au {date}. Merci de bien vouloir régulariser votre situation.\n\n{schoolName}";
const DEFAULT_REMINDER_AR =
  "مرحبًا {parentName}،\n\nنذكركم بأن مبلغ {amount} أوقية موريتانية الخاص بالرسوم الدراسية لـ {studentName} لا يزال معلقًا، وتاريخ الاستحقاق هو {date}. يرجى التكرم بتسوية وضعيتكم.\n\n{schoolName}";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const { statut } = await searchParams;
  // Statuts, retards et tendances sont calculés ici, au rendu serveur : lus
  // dans le navigateur, un frais échu à minuit pouvait changer de badge entre
  // le HTML reçu et l'hydratation.
  const now = new Date();

  const [fees, students, school, template] = await Promise.all([
    prisma.fee.findMany({
      where: { schoolId: user.schoolId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            classId: true,
            classRoom: { select: { name: true } },
            parentLinks: {
              where: { isPrimary: true },
              take: 1,
              select: {
                parent: {
                  select: { firstName: true, lastName: true, phone: true, relationship: true },
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
    prisma.student.findMany({
      where: { schoolId: user.schoolId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { classRoom: { select: { name: true } } },
    }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true, plan: true, subscriptionStatus: true } }),
    prisma.messageTemplate.findFirst({
      where: { schoolId: user.schoolId, key: "PAYMENT_REMINDER" },
      select: { body: true, bodyAr: true },
    }),
  ]);

  const bilingual = schoolHasFeature(school, FEATURES.BILINGUAL_MESSAGES);

  const rows: FeeRow[] = fees
    .map((f) => {
      const totalPaid = f.payments.reduce((sum, p) => sum + p.amount, 0);
      const amounts = { amount: f.amount, totalPaid, dueDate: f.dueDate };
      const parent = f.student.parentLinks[0]?.parent ?? null;
      return {
        id: f.id,
        label: f.label,
        amount: f.amount,
        dueDate: f.dueDate.toISOString(),
        totalPaid,
        remaining: remainingOf(amounts),
        status: feeDisplayStatus(amounts, now),
        overdueDays: daysOverdue(amounts, now),
        student: {
          id: f.student.id,
          firstName: f.student.firstName,
          lastName: f.student.lastName,
          photoUrl: f.student.photoUrl,
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
    // échéance pour un frais encore sans versement.
    .sort((a, b) => feeListDay(b).localeCompare(feeListDay(a)));

  // — Tuiles : argent reçu mois par mois sur six mois, et recouvrement global.
  const months = lastMonthKeys(now, 6);
  const payments = fees.flatMap((f) => f.payments);
  const collectedByMonth = monthlySums(
    payments.map((p) => ({ at: p.paidAt, amount: p.amount })),
    months,
  );
  const paymentsByMonth = months.map(
    (key) => payments.filter((p) => isInMonth(p.paidAt, key)).length,
  );
  const billed = rows.reduce((sum, r) => sum + r.amount, 0);
  const collected = rows.reduce((sum, r) => sum + r.totalPaid, 0);
  const last = months.length - 1;

  const kpis: PaymentsKpis = {
    collected,
    collectedByMonth,
    collectedChange: percentChange(collectedByMonth[last] ?? 0, collectedByMonth[last - 1] ?? 0),
    outstanding: rows.reduce((sum, r) => sum + r.remaining, 0),
    lateCount: rows.filter((r) => r.overdueDays > 0).length,
    paymentCount: payments.length,
    paymentsByMonth,
    billed,
    rate: collectionRate(billed, collected),
  };

  const studentOptions = students.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    className: s.classRoom?.name ?? null,
  }));

  return (
    <FinanceView
      // « Paiements » et « Impayés » du menu ouvrent ce même écran, chacun
      // avec son filtre : la clé remonte la vue quand l'adresse change, sans
      // quoi le filtre du premier affichage restait en place.
      key={statut ?? "tous"}
      initialStatus={statut === "impayes" ? "UNPAID" : "ALL"}
      fees={rows}
      kpis={kpis}
      students={studentOptions}
      schoolName={school?.name ?? "Madrasati"}
      reminderTemplate={template?.body ?? DEFAULT_REMINDER}
      reminderTemplateAr={bilingual ? (template?.bodyAr ?? DEFAULT_REMINDER_AR) : undefined}
    />
  );
}
