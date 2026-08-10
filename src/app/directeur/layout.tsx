import type { ReactNode } from "react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";

export default async function DirectorLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true },
  });

  return (
    <AppShell
      navKey="director"
      schoolName={school?.name ?? "Madrasati"}
      userName={user.name ?? ""}
      roleLabel="Directeur"
    >
      {children}
    </AppShell>
  );
}
