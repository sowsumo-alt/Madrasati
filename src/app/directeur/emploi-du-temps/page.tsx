import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { ScheduleView, type ScheduleClassOption, type SlotRow } from "./schedule-view";
import { CURRENT_YEAR } from "@/lib/school-year";

export default async function SchedulePage() {
  const user = await requireRole(ROLES.DIRECTOR);

  const [classes, slots, school] = await Promise.all([
    prisma.classRoom.findMany({
      where: { schoolId: user.schoolId, ...CURRENT_YEAR },
      orderBy: { name: "asc" },
      include: {
        classSubjects: {
          include: {
            subject: { select: { name: true } },
            teacher: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.scheduleSlot.findMany({
      where: { classRoom: { schoolId: user.schoolId, ...CURRENT_YEAR } },
      include: {
        classSubject: {
          include: {
            subject: { select: { name: true } },
            teacher: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }),
  ]);

  const classOptions: ScheduleClassOption[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    classSubjects: c.classSubjects.map((cs) => ({
      id: cs.id,
      subjectName: cs.subject.name,
      teacherName: cs.teacher ? `${cs.teacher.firstName} ${cs.teacher.lastName}` : null,
    })),
  }));

  const slotRows: SlotRow[] = slots.map((s) => ({
    id: s.id,
    classId: s.classId,
    dayOfWeek: s.dayOfWeek,
    startMinutes: s.startMinutes,
    endMinutes: s.endMinutes,
    room: s.room,
    subjectName: s.classSubject.subject.name,
    teacherName: s.classSubject.teacher
      ? `${s.classSubject.teacher.firstName} ${s.classSubject.teacher.lastName}`
      : null,
  }));

  return (
    <ScheduleView
      classes={classOptions}
      slots={slotRows}
      schoolName={school?.name ?? "Madrasati"}
    />
  );
}
