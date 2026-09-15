import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { StudentsView, type StudentRow } from "./students-view";
import { CURRENT_YEAR } from "@/lib/school-year";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; new?: string; classe?: string; famille?: string }>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const { q, new: openNew, classe, famille } = await searchParams;

  const [students, classes, school, currentYear] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId: user.schoolId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        classRoom: { select: { name: true } },
        parentLinks: {
          where: { isPrimary: true },
          // Le nombre d'enfants du parent : à partir de deux, c'est une
          // famille que l'on peut afficher d'un clic.
          include: { parent: { include: { _count: { select: { studentLinks: true } } } } },
          take: 1,
        },
      },
    }),
    prisma.classRoom.findMany({
      where: { schoolId: user.schoolId, ...CURRENT_YEAR },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { name: true },
    }),
    prisma.academicYear.findFirst({
      where: { schoolId: user.schoolId, isCurrent: true },
      select: { label: true },
    }),
  ]);

  const rows: StudentRow[] = students.map((s) => {
    const parent = s.parentLinks[0]?.parent;
    return {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      dateOfBirth: s.dateOfBirth ? s.dateOfBirth.toISOString() : null,
      gender: s.gender,
      status: s.status,
      classId: s.classId,
      className: s.classRoom?.name ?? null,
      photoUrl: s.photoUrl,
      placeOfBirth: s.placeOfBirth,
      nationality: s.nationality,
      motherName: s.motherName,
      enrollmentDate: s.enrollmentDate.toISOString(),
      parent: parent
        ? {
            id: parent.id,
            firstName: parent.firstName,
            lastName: parent.lastName,
            phone: parent.phone,
            address: parent.address,
            familyName: parent.familyName,
            familySize: parent._count.studentLinks,
          }
        : null,
    };
  });

  return (
    <StudentsView
      // Remonte la vue quand la recherche globale change de terme, sinon
      // l'état local garderait l'ancien filtre.
      key={`${q ?? ""}|${classe ?? ""}|${famille ?? ""}`}
      students={rows}
      classes={classes}
      schoolName={school?.name ?? "Madrasati"}
      currentYearLabel={currentYear?.label ?? null}
      initialQuery={q ?? ""}
      // « Voir les élèves » depuis la fiche d'une classe (?classe=<id>).
      initialClassFilter={classe && classes.some((c) => c.id === classe) ? classe : "ALL"}
      autoOpenNew={openNew === "1"}
      // Enfants d'une même famille (?famille=<parentId>), depuis sa fiche.
      initialFamilyFilter={famille && rows.some((r) => r.parent?.id === famille) ? famille : null}
    />
  );
}
