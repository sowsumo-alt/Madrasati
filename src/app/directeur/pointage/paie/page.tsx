import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { ensureSessions, loadTimesheetSchool, monthPayroll } from "@/lib/timesheet-data";
import { monthKeyOf, timesheetMonths } from "@/lib/timesheet";
import { TimesheetDisabled, TimesheetHeader } from "../timesheet-tabs";
import { PayrollView } from "./payroll-view";

/**
 * Paie du mois : heures pointées × taux horaire, moins les retards, avances
 * et autres déductions. Une fois validée, la paie est figée.
 */
export default async function TimesheetPayrollPage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const user = await requireRole(ROLES.DIRECTOR);
  const school = await loadTimesheetSchool(user.schoolId);
  if (!school?.enabled) return <TimesheetDisabled />;

  const now = new Date();
  await ensureSessions(user.schoolId, now);
  const months = timesheetMonths(school.startDate, now);
  const { mois } = await searchParams;
  const key = mois && months.includes(mois) ? mois : monthKeyOf(now);
  const payroll = await monthPayroll(user.schoolId, key, now);

  return (
    <div className="space-y-5">
      <TimesheetHeader current="paie" title="Paie du pointage" subtitle="Heures pointées × taux horaire, moins les retards, avances et déductions." />
      <PayrollView
        month={key}
        months={months}
        lines={payroll.lines}
        totals={payroll.totals}
        adjustments={payroll.adjustments.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }))}
        teachers={payroll.teachers.map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}`.trim(), hourlyRate: t.hourlyRate }))}
        locked={payroll.locked ? { at: payroll.locked.at.toISOString(), by: payroll.locked.by } : null}
        lateDeduction={payroll.lateDeduction}
        readOnly={user.readOnly}
      />
    </div>
  );
}
