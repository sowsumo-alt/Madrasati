import { requireSuperAdmin } from "@/lib/super-admin-session";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/roles";
import {
  isPlan,
  isSubscriptionStatus,
  computeMonthlyDue,
  daysBetween,
  trialEndsAt,
} from "@/lib/plans";
import { SuperAdminDashboard, type SchoolRow } from "./dashboard-view";

const MONTH_LABELS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

const REVENUE_MONTHS = 6;

/** Les derniers mois, du plus ancien au plus récent. */
function recentMonths(count: number) {
  const months: { label: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: MONTH_LABELS[d.getMonth()], year: d.getFullYear(), month: d.getMonth() });
  }
  return months;
}

export default async function SuperAdminPage() {
  await requireSuperAdmin();

  const now = new Date();
  const months = recentMonths(REVENUE_MONTHS);
  const since = new Date(months[0].year, months[0].month, 1);
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [schools, studentCounts, directors, subscriptionPayments] = await Promise.all([
    prisma.school.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        city: true,
        phone: true,
        plan: true,
        subscriptionStatus: true,
        lastPaymentAt: true,
        nextDueAt: true,
        createdAt: true,
      },
    }),
    // Un seul groupBy plutôt qu'un count par école : le tableau liste toutes
    // les écoles de la plateforme, donc une requête par ligne se dégraderait
    // à mesure que des clients s'ajoutent.
    prisma.student.groupBy({
      by: ["schoolId"],
      where: { status: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { role: ROLES.DIRECTOR },
      orderBy: { createdAt: "asc" },
      select: { schoolId: true, name: true, phone: true },
    }),
    prisma.subscriptionPayment.findMany({
      where: { paidAt: { gte: since } },
      select: { paidAt: true, amount: true },
    }),
  ]);

  const studentCountBySchool = new Map(
    studentCounts.map((c) => [c.schoolId, c._count._all]),
  );
  // Le directeur fondateur (le plus ancien) fait foi quand une école en
  // compte plusieurs : c'est lui l'interlocuteur de facturation.
  const directorBySchool = new Map<string, { name: string; phone: string | null }>();
  for (const d of directors) {
    if (!directorBySchool.has(d.schoolId)) {
      directorBySchool.set(d.schoolId, { name: d.name, phone: d.phone });
    }
  }

  const rows: SchoolRow[] = schools.map((s) => {
    const studentCount = studentCountBySchool.get(s.id) ?? 0;
    const plan = isPlan(s.plan) ? s.plan : "standard";
    const subscriptionStatus = isSubscriptionStatus(s.subscriptionStatus)
      ? s.subscriptionStatus
      : "trial";
    const director = directorBySchool.get(s.id) ?? null;

    // Retard calculé côté serveur : le client n'a pas à refaire ce calcul
    // avec son horloge locale, qui donnerait un compte différent selon le
    // fuseau et provoquerait une incohérence d'hydratation.
    const daysLate =
      s.nextDueAt && s.nextDueAt < now ? Math.max(0, daysBetween(s.nextDueAt, now)) : null;

    const trialEnd =
      subscriptionStatus === "trial"
        ? trialEndsAt({ createdAt: s.createdAt, nextDueAt: s.nextDueAt })
        : null;

    return {
      id: s.id,
      name: s.name,
      city: s.city,
      studentCount,
      plan,
      subscriptionStatus,
      lastPaymentAt: s.lastPaymentAt?.toISOString() ?? null,
      nextDueAt: s.nextDueAt?.toISOString() ?? null,
      amountDue: computeMonthlyDue(plan, studentCount),
      directorName: director?.name ?? null,
      // Le téléphone du directeur prime sur celui de l'école : c'est une
      // personne qu'on joint sur WhatsApp, pas un standard.
      directorPhone: director?.phone ?? s.phone ?? null,
      createdAt: s.createdAt.toISOString(),
      daysLate: daysLate && daysLate > 0 ? daysLate : null,
      trialEndsAt: trialEnd?.toISOString() ?? null,
      trialDaysLeft: trialEnd ? daysBetween(now, trialEnd) : null,
    };
  });

  const revenueByMonth = months.map((m) => ({
    label: m.label,
    value: subscriptionPayments
      .filter((p) => p.paidAt.getFullYear() === m.year && p.paidAt.getMonth() === m.month)
      .reduce((sum, p) => sum + p.amount, 0),
  }));

  const newThisMonth = schools.filter((s) => s.createdAt >= startOfThisMonth).length;

  return (
    <SuperAdminDashboard
      schools={rows}
      revenueByMonth={revenueByMonth}
      newThisMonth={newThisMonth}
    />
  );
}
