import type { ReactNode } from "react";
import { requireRole } from "@/lib/session";
import { ROLES, ROLE_LABEL_KEYS } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { AlertTriangle } from "lucide-react";
import { getTeacherScope } from "@/lib/teacher-scope";
import { getTranslations } from "@/lib/i18n/server";
import { getAppTheme } from "@/lib/app-theme-server";
import { effectivePlan } from "@/lib/plans";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const user = await requireRole(ROLES.TEACHER);
  const [school, scope, { t }] = await Promise.all([
    prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { name: true, plan: true, subscriptionStatus: true, timesheetEnabled: true },
    }),
    getTeacherScope(user.id, user.schoolId),
    getTranslations(),
  ]);
  // La cloche : messages de la direction non lus (statut de séance modifié, paie validée).
  const unread =
    school?.timesheetEnabled && scope
      ? await prisma.teacherNotification.count({ where: { teacherId: scope.teacher.id, readAt: null } })
      : 0;

  return (
    <AppShell
      navKey="teacher"
      schoolName={school?.name ?? "Madrasati"}
      userName={user.name ?? ""}
      roleKey={ROLE_LABEL_KEYS.TEACHER}
      plan={school ? effectivePlan(school) : "standard"}
      modules={school?.timesheetEnabled ? ["timesheet"] : []}
      alertCount={unread}
      alertHref={school?.timesheetEnabled ? "/enseignant/pointage" : "#"}
      alertLabel={unread > 0 ? `${unread} message(s) de la direction` : "Aucun nouveau message"}
      theme={await getAppTheme()}
    >
      {scope && scope.currentClassIds.length === 0 && (
        <p
          className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          data-testid="teacher-no-class-banner"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          {t("teacherHome.noClassBanner")}
        </p>
      )}
      {children}
    </AppShell>
  );
}
