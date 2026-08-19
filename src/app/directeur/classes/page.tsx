import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { ClassesView, type ClassRow, type SubjectRow } from "./classes-view";
import { CURRENT_YEAR } from "@/lib/school-year";

export default async function ClassesPage() {
  const user = await requireRole(ROLES.DIRECTOR);

  const [classes, subjects, teachers] = await Promise.all([
    prisma.classRoom.findMany({
      where: { schoolId: user.schoolId, ...CURRENT_YEAR },
      orderBy: { name: "asc" },
      include: {
        mainTeacher: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { students: { where: { status: "ACTIVE" } } } },
        classSubjects: {
          include: {
            subject: { select: { name: true } },
            teacher: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.subject.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { name: "asc" },
    }),
    prisma.teacher.findMany({
      where: { schoolId: user.schoolId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const classRows: ClassRow[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level,
    capacity: c.capacity,
    studentCount: c._count.students,
    mainTeacher: c.mainTeacher,
    assignments: c.classSubjects.map((cs) => ({
      subjectId: cs.subjectId,
      subjectName: cs.subject.name,
      teacherId: cs.teacherId,
      teacherName: cs.teacher ? `${cs.teacher.firstName} ${cs.teacher.lastName}` : null,
    })),
  }));

  const subjectRows: SubjectRow[] = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    nameAr: s.nameAr,
    coefficient: s.coefficient,
    isActive: s.isActive,
  }));

  return <ClassesView classes={classRows} subjects={subjectRows} teachers={teachers} />;
}
