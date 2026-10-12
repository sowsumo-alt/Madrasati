import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { CURRENT_YEAR } from "@/lib/school-year";
import { TeachersView, type TeacherRow } from "./teachers-view";

export default async function TeachersPage() {
  const user = await requireRole(ROLES.DIRECTOR);

  const [teachers, subjects, school, taught, mainOf] = await Promise.all([
    prisma.teacher.findMany({
      where: { schoolId: user.schoolId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { user: { select: { email: true } } },
    }),
    prisma.subject.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }),
    // Ce que chacun enseigne cette année : sans classe, un enseignant qui se
    // connecte ne voit ni élèves, ni appel, ni notes.
    prisma.classSubject.findMany({
      where: { teacherId: { not: null }, classRoom: { schoolId: user.schoolId, ...CURRENT_YEAR } },
      select: { teacherId: true, classRoom: { select: { name: true } } },
    }),
    prisma.classRoom.findMany({
      where: { schoolId: user.schoolId, ...CURRENT_YEAR, mainTeacherId: { not: null } },
      select: { mainTeacherId: true, name: true },
    }),
  ]);

  const classesOf = new Map<string, Set<string>>();
  const add = (teacherId: string | null, name: string) => {
    if (!teacherId) return;
    if (!classesOf.has(teacherId)) classesOf.set(teacherId, new Set());
    classesOf.get(teacherId)!.add(name);
  };
  for (const cs of taught) add(cs.teacherId, cs.classRoom.name);
  for (const c of mainOf) add(c.mainTeacherId, c.name);

  const rows: TeacherRow[] = teachers.map((t) => ({
    id: t.id,
    firstName: t.firstName,
    lastName: t.lastName,
    phone: t.phone,
    email: t.email,
    diploma: t.diploma,
    subjectSpecialty: t.subjectSpecialty,
    monthlySalary: t.monthlySalary,
    hireDate: t.hireDate ? t.hireDate.toISOString() : null,
    status: t.status,
    userId: t.userId,
    accountEmail: t.user?.email ?? null,
    classes: [...(classesOf.get(t.id) ?? [])].sort((a, b) => a.localeCompare(b, "fr")),
  }));

  return (
    <TeachersView
      teachers={rows}
      subjects={subjects.map((s) => s.name)}
      schoolName={school?.name ?? "Madrasati"}
    />
  );
}
