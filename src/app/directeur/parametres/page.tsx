import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { effectivePlan, trialEndsAt, daysBetween } from "@/lib/plans";
import { SettingsView, type YearRow } from "./settings-view";
import { CURRENT_YEAR } from "@/lib/school-year";

export default async function SettingsPage() {
  const user = await requireRole(ROLES.DIRECTOR);

  const [school, years, students, teachers, classes] = await Promise.all([
    prisma.school.findUnique({ where: { id: user.schoolId } }),
    prisma.academicYear.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { startDate: "desc" },
    }),
    prisma.student.count({ where: { schoolId: user.schoolId, status: "ACTIVE" } }),
    prisma.teacher.count({ where: { schoolId: user.schoolId, status: "ACTIVE" } }),
    prisma.classRoom.count({ where: { schoolId: user.schoolId, ...CURRENT_YEAR } }),
  ]);

  if (!school) notFound();

  const yearRows: YearRow[] = years.map((y) => ({
    id: y.id,
    label: y.label,
    startDate: y.startDate.toISOString(),
    endDate: y.endDate.toISOString(),
    isCurrent: y.isCurrent,
  }));

  return (
    <SettingsView
      school={{
        name: school.name,
        address: school.address ?? "",
        phone: school.phone ?? "",
        email: school.email ?? "",
        logoUrl: school.logoUrl,
      }}
      years={yearRows}
      counts={{ students, teachers, classes }}
      // Plan réellement accordé, pas le plan inscrit : une école « Restreinte »
      // lisait « Formule actuelle : Avancé » sur cet écran alors que toutes
      // les fonctionnalités Avancé lui étaient refusées partout ailleurs.
      plan={effectivePlan(school)}
      trialDaysLeft={
        school.subscriptionStatus === "trial"
          ? daysBetween(new Date(), trialEndsAt(school))
          : null
      }
    />
  );
}
