import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { isoDay } from "@/lib/dashboard-data";
import {
  ScheduleView,
  type ScheduleClassOption,
  type ScheduleEvent,
  type ScheduleYearOption,
  type SlotRow,
} from "./schedule-view";

const fullName = (t: { firstName: string; lastName: string } | null) =>
  t ? `${t.firstName} ${t.lastName}` : null;

export default async function SchedulePage() {
  const user = await requireRole(ROLES.DIRECTOR);
  const schoolId = user.schoolId;

  // Toutes les années et non la seule année en cours : l'emploi du temps
  // d'une année terminée reste consultable, en lecture seule.
  const [years, classes, slots, exams, holidays, school] = await Promise.all([
    prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: { startDate: "desc" },
      select: { id: true, label: true, isCurrent: true },
    }),
    prisma.classRoom.findMany({
      where: { schoolId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        academicYearId: true,
        classSubjects: {
          select: {
            id: true,
            subject: { select: { name: true } },
            teacher: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.scheduleSlot.findMany({
      where: { classRoom: { schoolId } },
      select: {
        id: true,
        classId: true,
        dayOfWeek: true,
        startMinutes: true,
        endMinutes: true,
        room: true,
        classRoom: { select: { name: true } },
        classSubject: {
          select: {
            subject: { select: { name: true } },
            teacher: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.exam.findMany({
      where: { schoolId },
      select: { id: true, title: true, date: true, classId: true },
    }),
    // Jours fériés propres à l'école et jours fériés nationaux (sans école).
    prisma.holiday.findMany({
      where: { OR: [{ schoolId }, { schoolId: null }] },
      select: { id: true, name: true, date: true },
    }),
    prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
  ]);

  const yearOptions: ScheduleYearOption[] = years;

  const classOptions: ScheduleClassOption[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    academicYearId: c.academicYearId,
    classSubjects: c.classSubjects.map((cs) => ({
      id: cs.id,
      subjectName: cs.subject.name,
      teacherId: cs.teacher?.id ?? null,
      teacherName: fullName(cs.teacher),
    })),
  }));

  const slotRows: SlotRow[] = slots.map((s) => ({
    id: s.id,
    classId: s.classId,
    className: s.classRoom.name,
    dayOfWeek: s.dayOfWeek,
    startMinutes: s.startMinutes,
    endMinutes: s.endMinutes,
    room: s.room,
    subjectName: s.classSubject.subject.name,
    teacherId: s.classSubject.teacher?.id ?? null,
    teacherName: fullName(s.classSubject.teacher),
  }));

  const examEvents: ScheduleEvent[] = exams.map((e) => ({
    id: e.id,
    day: isoDay(e.date),
    label: e.title,
    classId: e.classId,
  }));
  const holidayEvents: ScheduleEvent[] = holidays.map((h) => ({
    id: h.id,
    day: isoDay(h.date),
    label: h.name,
    classId: null,
  }));

  return (
    <ScheduleView
      years={yearOptions}
      classes={classOptions}
      slots={slotRows}
      exams={examEvents}
      holidays={holidayEvents}
      schoolName={school?.name ?? "Madrasati"}
      todayIso={isoDay(new Date())}
    />
  );
}
