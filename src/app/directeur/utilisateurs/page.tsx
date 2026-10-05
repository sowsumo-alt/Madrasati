import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { UsersView, type DirectorRow } from "./users-view";

/**
 * Les utilisateurs de l'école : le directeur principal et ses associés
 * (directeurs ou lecture seule), chacun avec son e-mail et son mot de passe.
 * Une école = un seul espace de données, partagé par tous.
 */
export default async function UsersPage() {
  const user = await requireRole(ROLES.DIRECTOR);
  const [school, directors, others, lastActions] = await Promise.all([
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }),
    prisma.user.findMany({
      where: { schoolId: user.schoolId, role: ROLES.DIRECTOR },
      orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isOwner: true,
        access: true,
        isActive: true,
        mustChangePassword: true,
      },
    }),
    prisma.user.groupBy({
      by: ["role"],
      where: { schoolId: user.schoolId, role: { not: ROLES.DIRECTOR } },
      _count: { _all: true },
    }),
    prisma.activityLog.groupBy({
      by: ["userId"],
      where: { schoolId: user.schoolId, userId: { not: null } },
      _max: { createdAt: true },
    }),
  ]);

  const rows: DirectorRow[] = directors.map((d) => ({
    ...d,
    phone: d.phone ?? "",
    isSelf: d.id === user.id,
    lastAction: lastActions.find((a) => a.userId === d.id)?._max.createdAt?.toISOString() ?? null,
  }));
  const count = (role: string) => others.find((o) => o.role === role)?._count._all ?? 0;

  return (
    <UsersView
      rows={rows}
      canManage={user.isOwner}
      schoolName={school?.name ?? ""}
      teacherAccounts={count(ROLES.TEACHER)}
      parentAccounts={count(ROLES.PARENT)}
    />
  );
}
