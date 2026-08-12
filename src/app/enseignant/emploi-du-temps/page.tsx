import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { getTeacherScope } from "@/lib/teacher-scope";
import {
  TeacherScheduleView,
  type TeacherScheduleSlot,
} from "./teacher-schedule-view";
import type { TeacherClassSubjectOption } from "./teacher-slot-form-dialog";

export default async function TeacherSchedulePage() {
  const user = await requireRole(ROLES.TEACHER);
  const scope = await getTeacherScope(user.id, user.schoolId);

  const [slots, ownedClassSubjects, school] = await Promise.all([
    scope
      ? prisma.scheduleSlot.findMany({
          // Seulement les créneaux que cet enseignant assure réellement.
          where: { classSubject: { teacherId: scope.teacher.id } },
          orderBy: { startMinutes: "asc" },
          include: {
            classRoom: { select: { name: true } },
            classSubject: { include: { subject: { select: { name: true } } } },
          },
        })
      : Promise.resolve([]),
    scope
      ? prisma.classSubject.findMany({
          where: { teacherId: scope.teacher.id },
          orderBy: { subject: { name: "asc" } },
          include: {
            subject: { select: { name: true } },
            classRoom: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }),
  ]);

  const slotRows: TeacherScheduleSlot[] = slots.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    startMinutes: s.startMinutes,
    endMinutes: s.endMinutes,
    room: s.room,
    subjectName: s.classSubject.subject.name,
    className: s.classRoom.name,
  }));

  const classSubjectOptions: TeacherClassSubjectOption[] = ownedClassSubjects.map((cs) => ({
    id: cs.id,
    subjectName: cs.subject.name,
    className: cs.classRoom.name,
  }));

  return (
    <TeacherScheduleView
      slots={slotRows}
      classSubjects={classSubjectOptions}
      schoolName={school?.name ?? "Madrasati"}
      teacherName={scope ? `${scope.teacher.firstName} ${scope.teacher.lastName}` : ""}
    />
  );
}
