import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { isPlan, trialEndsAt, daysBetween } from "@/lib/plans";
import { SettingsView, type YearRow } from "./settings-view";

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
    prisma.classRoom.count({ where: { schoolId: user.schoolId } }),
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
      plan={isPlan(school.plan) ? school.plan : "standard"}
      trialDaysLeft={
        school.subscriptionStatus === "trial"
          ? daysBetween(new Date(), trialEndsAt(school))
          : null
      }
    />
  );
}
