import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { TeachersView, type TeacherRow } from "./teachers-view";

export default async function TeachersPage() {
  const user = await requireRole(ROLES.DIRECTOR);

  const [teachers, subjects, school] = await Promise.all([
    prisma.teacher.findMany({
      where: { schoolId: user.schoolId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.subject.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }),
  ]);

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
  }));

  return (
    <TeachersView
      teachers={rows}
      subjects={subjects.map((s) => s.name)}
      schoolName={school?.name ?? "Madrasati"}
    />
  );
}
