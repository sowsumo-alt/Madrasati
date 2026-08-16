import type { ReactNode } from "react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { isPlan } from "@/lib/plans";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(ROLES.TEACHER);
  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true, plan: true },
  });

  return (
    <AppShell
      navKey="teacher"
      schoolName={school?.name ?? "Madrasati"}
      userName={user.name ?? ""}
      roleLabel="Enseignant"
      plan={school?.plan && isPlan(school.plan) ? school.plan : "standard"}
    >
      {children}
    </AppShell>
  );
}
