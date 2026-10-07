import { requireSuperAdmin } from "@/lib/super-admin-session";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/roles";
import { isPlan, isSubscriptionStatus, computeMonthlyDue, daysBetween, trialEndsAt } from "@/lib/plans";
import { formatAmount } from "@/lib/format";
import { lastMonths, percentChange, relativeTime, revenuePeriod, schoolCode } from "@/lib/super-admin-stats";
import { SuperAdminDashboard } from "./dashboard-view";
import type { ActivityItem, DashboardData, SchoolRow } from "./sections/types";

/**
 * Tableau de bord Super Admin. Tout est calculé ici, côté serveur — retards,
 * tendances, dates relatives : le navigateur n'a pas à refaire ces calculs
 * avec son horloge locale, qui donnerait d'autres comptes selon le fuseau.
 */
export default async function SuperAdminPage() {
  await requireSuperAdmin();

  const now = new Date();
  // Deux périodes de 12 mois : les 12 derniers et les 12 d'avant, pour l'évolution.
  const since = new Date(now.getFullYear(), now.getMonth() - 23, 1);
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [schools, studentCounts, directors, subscriptionPayments] = await Promise.all([
    prisma.school.findMany({
      orderBy: { createdAt: "asc" },
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
      orderBy: { paidAt: "desc" },
      select: { id: true, paidAt: true, amount: true, school: { select: { name: true } } },
    }),
  ]);

  const studentCountBySchool = new Map(studentCounts.map((c) => [c.schoolId, c._count._all]));
  // Le directeur fondateur (le plus ancien) fait foi quand une école en
  // compte plusieurs : c'est lui l'interlocuteur de facturation.
  const directorBySchool = new Map<string, { name: string; phone: string | null }>();
  for (const d of directors) {
    if (!directorBySchool.has(d.schoolId)) directorBySchool.set(d.schoolId, { name: d.name, phone: d.phone });
  }

  const rows: SchoolRow[] = schools
    .map((s, index) => {
      const studentCount = studentCountBySchool.get(s.id) ?? 0;
      const plan = isPlan(s.plan) ? s.plan : "standard";
      const subscriptionStatus = isSubscriptionStatus(s.subscriptionStatus) ? s.subscriptionStatus : "trial";
      const director = directorBySchool.get(s.id) ?? null;
      const daysLate = s.nextDueAt && s.nextDueAt < now ? Math.max(0, daysBetween(s.nextDueAt, now)) : null;
      const trialEnd = subscriptionStatus === "trial" ? trialEndsAt({ createdAt: s.createdAt, nextDueAt: s.nextDueAt }) : null;
      return {
        id: s.id,
        code: schoolCode(index + 1),
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
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  // — Indicateurs
  const months6 = lastMonths(now, 6);
  const endOf = (m: { year: number; month: number }) => new Date(m.year, m.month + 1, 1);
  const inMonth = (d: Date, m: { year: number; month: number }) => d.getFullYear() === m.year && d.getMonth() === m.month;
  const monthRevenue = (m: { year: number; month: number }) =>
    subscriptionPayments.filter((p) => inMonth(p.paidAt, m)).reduce((sum, p) => sum + p.amount, 0);
  const lastMonth = lastMonths(now, 2)[0];
  const revenueThisMonth = monthRevenue(months6[5]);
  const late = rows.filter((r) => r.subscriptionStatus === "past_due");

  const kpis: DashboardData["kpis"] = {
    totalSchools: schools.length,
    newThisWeek: schools.filter((s) => s.createdAt >= weekAgo).length,
    newThisMonth: schools.filter((s) => s.createdAt >= startOfThisMonth).length,
    schoolsTrend: months6.map((m) => schools.filter((s) => s.createdAt < endOf(m)).length),
    newTrend: months6.map((m) => schools.filter((s) => inMonth(s.createdAt, m)).length),
    revenueThisMonth,
    revenueChange: percentChange(revenueThisMonth, monthRevenue(lastMonth)),
    revenueTrend: months6.map(monthRevenue),
    late: late.length,
    maxDaysLate: late.reduce<number | null>((max, r) => (r.daysLate != null && (max == null || r.daysLate > max) ? r.daysLate : max), null),
    pending: rows.filter((r) => r.subscriptionStatus === "pending").length,
  };

  // — Activité récente : inscriptions d'écoles et paiements d'abonnement.
  const activity: ActivityItem[] = [
    ...schools.map((s) => ({
      at: s.createdAt,
      item: {
        id: `school-${s.id}`,
        kind: s.subscriptionStatus === "pending" ? ("pending" as const) : ("school" as const),
        title: s.subscriptionStatus === "pending" ? "Nouvelle école en attente" : "Nouvelle école inscrite",
        detail: s.name,
        when: relativeTime(s.createdAt, now),
      },
    })),
    ...subscriptionPayments.map((p) => ({
      at: p.paidAt,
      item: {
        id: `payment-${p.id}`,
        kind: "payment" as const,
        title: "Paiement reçu",
        detail: `${formatAmount(p.amount)} MRU — ${p.school.name}`,
        when: relativeTime(p.paidAt, now),
      },
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 15)
    .map((e) => e.item);

  const data: DashboardData = {
    todayLabel: now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
    kpis,
    revenue: {
      periods: { 6: revenuePeriod(subscriptionPayments, now, 6), 12: revenuePeriod(subscriptionPayments, now, 12) },
      thisMonth: revenueThisMonth,
      expectedMonthly: rows.filter((r) => r.subscriptionStatus === "active").reduce((sum, r) => sum + (r.amountDue ?? 0), 0),
    },
    activity,
    schools: rows,
  };

  return <SuperAdminDashboard data={data} />;
}
