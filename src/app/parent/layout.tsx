import type { ReactNode } from "react";
import { requireFeature } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { effectivePlan, FEATURES } from "@/lib/plans";

export default async function ParentLayout({ children }: { children: ReactNode }) {
  // Filet de sécurité : si l'école a été rétrogradée en Standard après avoir
  // eu des comptes parents, ceux-ci ne doivent plus pouvoir se connecter —
  // même si createParentAccount() ne peut plus en créer de nouveaux.
  const user = await requireFeature(FEATURES.PARENT_PORTAL, ROLES.PARENT);
  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true, plan: true, subscriptionStatus: true },
  });

  return (
    <AppShell
      navKey="parent"
      schoolName={school?.name ?? "Madrasati"}
      userName={user.name ?? ""}
      roleLabel="Parent"
      plan={school ? effectivePlan(school) : "standard"}
    >
      {children}
    </AppShell>
  );
}
