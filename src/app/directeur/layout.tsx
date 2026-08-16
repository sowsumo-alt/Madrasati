import type { ReactNode } from "react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { isPlan } from "@/lib/plans";

export default async function DirectorLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const [school, overdueFees] = await Promise.all([
    prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { name: true, plan: true },
    }),
    // La cloche signale les frais échus non réglés : la seule alerte qui
    // demande une action de la direction au quotidien.
    prisma.fee.count({
      where: {
        schoolId: user.schoolId,
        status: { not: "PAID" },
        dueDate: { lt: new Date() },
      },
    }),
  ]);

  return (
    <AppShell
      navKey="director"
      schoolName={school?.name ?? "Madrasati"}
      userName={user.name ?? ""}
      roleLabel="Directeur"
      plan={school?.plan && isPlan(school.plan) ? school.plan : "standard"}
      searchHref="/directeur/eleves"
      alertCount={overdueFees}
      alertHref="/directeur/finance"
      alertLabel={
        overdueFees > 0
          ? `${overdueFees} frais échus non réglés`
          : "Aucun frais en retard"
      }
    >
      {children}
    </AppShell>
  );
}
