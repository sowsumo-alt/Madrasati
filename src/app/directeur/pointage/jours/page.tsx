import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { loadTimesheetSchool } from "@/lib/timesheet-data";
import { TimesheetDisabled, TimesheetHeader } from "../timesheet-tabs";
import { NonWorkingDays } from "./non-working-days";

/** Jours non travaillés (fériés, vacances) : aucune séance n'y est attendue. */
export default async function NonWorkingDaysPage() {
  const user = await requireRole(ROLES.DIRECTOR);
  const school = await loadTimesheetSchool(user.schoolId);
  if (!school?.enabled) return <TimesheetDisabled />;

  const year = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isCurrent: true },
    select: { startDate: true, endDate: true, label: true },
  });
  const from = year?.startDate ?? new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const to = year?.endDate ?? new Date(Date.UTC(new Date().getUTCFullYear(), 11, 31));
  const days = await prisma.holiday.findMany({
    where: { OR: [{ schoolId: user.schoolId }, { schoolId: null }], date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
    select: { id: true, name: true, date: true, schoolId: true },
  });

  return (
    <div className="space-y-5">
      <TimesheetHeader
        current="jours"
        title="Jours non travaillés"
        subtitle={`Fériés et vacances${year ? ` de l'année ${year.label}` : ""} : aucune séance n'est attendue ces jours-là.`}
      />
      <NonWorkingDays
        days={days.map((d) => ({ id: d.id, name: d.name, date: d.date.toISOString(), national: d.schoolId == null }))}
        readOnly={user.readOnly}
      />
    </div>
  );
}
