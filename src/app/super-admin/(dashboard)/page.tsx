import { requireSuperAdmin } from "@/lib/super-admin-session";
import { prisma } from "@/lib/prisma";
import { isPlan, isSubscriptionStatus, computeMonthlyDue } from "@/lib/plans";
import { SuperAdminDashboard, type SchoolRow } from "./dashboard-view";

export default async function SuperAdminPage() {
  await requireSuperAdmin();

  const schools = await prisma.school.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      city: true,
      plan: true,
      subscriptionStatus: true,
      lastPaymentAt: true,
      nextDueAt: true,
    },
  });

  const rows: SchoolRow[] = await Promise.all(
    schools.map(async (s) => {
      const studentCount = await prisma.student.count({
        where: { schoolId: s.id, status: "ACTIVE" },
      });
      const plan = isPlan(s.plan) ? s.plan : "standard";
      const subscriptionStatus = isSubscriptionStatus(s.subscriptionStatus)
        ? s.subscriptionStatus
        : "trial";

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
      };
    }),
  );

  return <SuperAdminDashboard schools={rows} />;
}
