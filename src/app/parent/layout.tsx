import type { ReactNode } from "react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(ROLES.PARENT);
  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true },
  });

  return (
    <AppShell
      navKey="parent"
      schoolName={school?.name ?? "Madrasati"}
      userName={user.name ?? ""}
      roleLabel="Parent"
    >
      {children}
    </AppShell>
  );
}
