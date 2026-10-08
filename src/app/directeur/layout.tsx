import type { ReactNode } from "react";
import { requireRole } from "@/lib/session";
import { ROLES, ROLE_LABEL_KEYS } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { dueFeesOf } from "@/lib/due-rule-data";
import { AppShell } from "@/components/layout/app-shell";
import { effectivePlan } from "@/lib/plans";
import { Eye } from "lucide-react";
import { ReadOnlyToasts } from "@/components/layout/read-only-toasts";
import { READ_ONLY_MESSAGE } from "@/lib/write-guard";

export default async function DirectorLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const [school, overdueFees] = await Promise.all([
    prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { name: true, plan: true, subscriptionStatus: true },
    }),
    // La cloche signale les frais échus non réglés — selon le jour limite et
    // la tolérance de l'école : la seule alerte qui demande une action de la
    // direction au quotidien.
    dueFeesOf(user.schoolId).then((fees) => fees.length),
  ]);

  return (
    <AppShell
      navKey="director"
      schoolName={school?.name ?? "Madrasati"}
      userName={user.name ?? ""}
      roleKey={user.readOnly ? "role.readOnly" : ROLE_LABEL_KEYS.DIRECTOR}
      plan={school ? effectivePlan(school) : "standard"}
      searchHref="/directeur/eleves"
      alertCount={overdueFees}
      alertHref="/directeur/notifications"
      alertLabel={
        overdueFees > 0
          ? `${overdueFees} frais échus non réglés`
          : "Aucun frais en retard"
      }
    >
      {user.readOnly && (
        <p
          className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"
          data-testid="read-only-banner"
        >
          <Eye className="h-4 w-4 shrink-0" />
          Accès en lecture seule : vous pouvez tout consulter, mais pas modifier.
        </p>
      )}
      {user.readOnly && <ReadOnlyToasts message={READ_ONLY_MESSAGE} />}
      {children}
    </AppShell>
  );
}
