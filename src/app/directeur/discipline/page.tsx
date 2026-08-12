import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { DisciplineView, type IncidentRow } from "./discipline-view";

export default async function DisciplinePage() {
  const user = await requireRole(ROLES.DIRECTOR);

  const [incidents, students] = await Promise.all([
    prisma.disciplineIncident.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { date: "desc" },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            classRoom: { select: { name: true } },
          },
        },
      },
    }),
    prisma.student.findMany({
      where: { schoolId: user.schoolId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { classRoom: { select: { name: true } } },
    }),
  ]);

  const rows: IncidentRow[] = incidents.map((i) => ({
    id: i.id,
    date: i.date.toISOString(),
    type: i.type,
    description: i.description,
    sanction: i.sanction,
    student: {
      id: i.student.id,
      firstName: i.student.firstName,
      lastName: i.student.lastName,
      className: i.student.classRoom?.name ?? null,
    },
  }));

  const studentOptions = students.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    className: s.classRoom?.name ?? null,
  }));

  return <DisciplineView incidents={rows} students={studentOptions} />;
}
