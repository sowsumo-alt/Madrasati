import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { ClassesView, type ClassRow, type SubjectRow } from "./classes-view";
import { CURRENT_YEAR } from "@/lib/school-year";
import { buildCatalog, compareClasses } from "@/lib/class-catalog";

export default async function ClassesPage() {
  const user = await requireRole(ROLES.DIRECTOR);

  const [classes, subjects, teachers, studentTotal, allLevels] = await Promise.all([
    prisma.classRoom.findMany({
      where: { schoolId: user.schoolId, ...CURRENT_YEAR },
      orderBy: { name: "asc" },
      include: {
        mainTeacher: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { students: { where: { status: "ACTIVE" } } } },
        classSubjects: {
          include: {
            subject: { select: { name: true, coefficient: true } },
            teacher: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.subject.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { name: "asc" },
      include: { _count: { select: { exams: true } } },
    }),
    prisma.teacher.findMany({
      where: { schoolId: user.schoolId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.student.count({ where: { schoolId: user.schoolId, status: "ACTIVE" } }),
    // Toutes années confondues : un niveau que l'école a ajouté elle-même
    // (« Mahadra — Niveau 1 ») lui reste proposé les années suivantes.
    prisma.classRoom.findMany({
      where: { schoolId: user.schoolId },
      distinct: ["category", "level"],
      select: { category: true, level: true, name: true },
    }),
  ]);

  // Dans l'ordre de la scolarité : Préscolaire, Fondamental, Collège, Lycée.
  const classRows: ClassRow[] = [...classes].sort(compareClasses).map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level,
    category: c.category,
    capacity: c.capacity,
    studentCount: c._count.students,
    mainTeacher: c.mainTeacher,
    assignments: c.classSubjects.map((cs) => ({
      subjectId: cs.subjectId,
      subjectName: cs.subject.name,
      coefficient: cs.coefficientOverride ?? cs.subject.coefficient,
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
    examCount: s._count.exams,
  }));

  return (
    <ClassesView
      classes={classRows}
      subjects={subjectRows}
      teachers={teachers}
      studentTotal={studentTotal}
      catalog={buildCatalog(allLevels)}
    />
  );
}
