import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { StudentsView, type StudentRow } from "./students-view";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const { q } = await searchParams;

  const [students, classes, school] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId: user.schoolId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        classRoom: { select: { name: true } },
        parentLinks: {
          where: { isPrimary: true },
          include: { parent: true },
          take: 1,
        },
      },
    }),
    prisma.classRoom.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { name: true },
    }),
  ]);

  const rows: StudentRow[] = students.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    dateOfBirth: s.dateOfBirth ? s.dateOfBirth.toISOString() : null,
    gender: s.gender,
    status: s.status,
    classId: s.classId,
    className: s.classRoom?.name ?? null,
    parent: s.parentLinks[0]
      ? {
          firstName: s.parentLinks[0].parent.firstName,
          lastName: s.parentLinks[0].parent.lastName,
          phone: s.parentLinks[0].parent.phone,
        }
      : null,
  }));

  return (
    <StudentsView
      // Remonte la vue quand la recherche globale change de terme, sinon
      // l'état local garderait l'ancien filtre.
      key={q ?? ""}
      students={rows}
      classes={classes}
      schoolName={school?.name ?? "Madrasati"}
      initialQuery={q ?? ""}
    />
  );
}
