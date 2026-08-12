import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { ReenrollView, type ReenrollStudent, type ReenrollClassOption } from "./reenroll-view";

export default async function ReenrollmentPage() {
  const user = await requireRole(ROLES.DIRECTOR);

  const currentYear = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isCurrent: true },
  });

  const [targetClasses, oldStudents] = await Promise.all([
    currentYear
      ? prisma.classRoom.findMany({
          where: { schoolId: user.schoolId, academicYearId: currentYear.id },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    currentYear
      ? prisma.student.findMany({
          where: {
            schoolId: user.schoolId,
            status: "ACTIVE",
            classRoom: { academicYearId: { not: currentYear.id } },
          },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          include: { classRoom: { include: { academicYear: true } } },
        })
      : Promise.resolve([]),
  ]);

  const students: ReenrollStudent[] = oldStudents.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    classId: s.classId,
    className: s.classRoom?.name ?? null,
    yearLabel: s.classRoom?.academicYear.label ?? null,
  }));

  const targetClassOptions: ReenrollClassOption[] = targetClasses;

  return (
    <ReenrollView
      students={students}
      targetClasses={targetClassOptions}
      hasCurrentYear={Boolean(currentYear)}
    />
  );
}
