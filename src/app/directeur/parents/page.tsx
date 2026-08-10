import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { ParentsView, type ParentRow } from "./parents-view";

export default async function ParentsPage() {
  const user = await requireRole(ROLES.DIRECTOR);

  const [parents, students, school] = await Promise.all([
    prisma.parent.findMany({
      where: { schoolId: user.schoolId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { studentLinks: { include: { student: true } } },
    }),
    prisma.student.findMany({
      where: { schoolId: user.schoolId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { classRoom: { select: { name: true } } },
    }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }),
  ]);

  const rows: ParentRow[] = parents.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    phone: p.phone,
    email: p.email,
    address: p.address,
    relationship: p.relationship,
    children: p.studentLinks.map((l) => ({
      id: l.student.id,
      name: `${l.student.firstName} ${l.student.lastName}`,
    })),
  }));

  const studentOptions = students.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    className: s.classRoom?.name ?? null,
  }));

  return (
    <ParentsView
      parents={rows}
      students={studentOptions}
      schoolName={school?.name ?? "Madrasati"}
    />
  );
}
