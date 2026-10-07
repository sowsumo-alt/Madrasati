import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { requireSuperAdmin } from "@/lib/super-admin-session";
import { prisma } from "@/lib/prisma";
import { TRIAL_REMINDER_DAYS, daysBetween, trialEndsAt } from "@/lib/plans";
import { SaShell } from "@/components/super-admin/sa-shell";
import { SA_THEME_COOKIE } from "@/components/super-admin/theme";

/**
 * Cadre de l'espace Super Admin : thème choisi (sombre par défaut, comme la
 * maquette) et alertes de la cloche — écoles à activer, en retard de
 * paiement, essais à relancer.
 */
export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireSuperAdmin();
  const theme = (await cookies()).get(SA_THEME_COOKIE)?.value === "light" ? "light" : "dark";

  const schools = await prisma.school.findMany({
    select: { subscriptionStatus: true, createdAt: true, nextDueAt: true },
  });
  const now = new Date();
  const alerts = {
    pending: schools.filter((s) => s.subscriptionStatus === "pending").length,
    late: schools.filter((s) => s.subscriptionStatus === "past_due").length,
    trialsEnding: schools.filter(
      (s) => s.subscriptionStatus === "trial" && daysBetween(now, trialEndsAt(s)) <= TRIAL_REMINDER_DAYS,
    ).length,
  };

  return (
    <SaShell adminName={admin.name} initialTheme={theme} alerts={alerts}>
      {children}
    </SaShell>
  );
}
