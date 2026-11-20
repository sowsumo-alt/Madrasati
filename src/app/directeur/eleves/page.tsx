import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { StudentsView, type StudentRow } from "./students-view";
import { CURRENT_YEAR } from "@/lib/school-year";
import { buildCatalog, classOptions } from "@/lib/class-catalog";
import { loadTuitionSettings, studentMoneySummaries, tuitionSummaries } from "@/lib/tuition-data";
import { lettersOf } from "@/lib/initials";
import { loadStudentPhotos } from "@/lib/school-cache";
import { pageOf } from "@/lib/list-page";
import { STUDENTS_PAGE_SIZE, filterStudents, parseStudentsParams } from "@/lib/students-query";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const params = await searchParams;
  const openNew = params.new;
  // Recherche, filtres et page dans l'adresse : le serveur filtre toute la
  // liste et n'envoie que la page affichée (photos comprises, pour elle seule).
  const state = parseStudentsParams(params);

  const [students, classes, school, currentYear, allLevels, tuitionSettings] = await Promise.all([
    // Toute l'école, pour filtrer : seulement les colonnes affichées ou filtrées.
    prisma.student.findMany({
      where: { schoolId: user.schoolId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        status: true,
        classId: true,
        placeOfBirth: true,
        nationality: true,
        nni: true,
        rimNumber: true,
        matricule: true,
        motherName: true,
        enrollmentDate: true,
        classRoom: { select: { name: true } },
        parentLinks: {
          where: { isPrimary: true },
          // Le nombre d'enfants du parent : à partir de deux, c'est une
          // famille que l'on peut afficher d'un clic.
          select: {
            parent: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                address: true,
                familyName: true,
                _count: { select: { studentLinks: true } },
              },
            },
          },
          take: 1,
        },
      },
    }),
    prisma.classRoom.findMany({
      where: { schoolId: user.schoolId, ...CURRENT_YEAR },
      select: { id: true, name: true, level: true, category: true },
    }),
    prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { name: true },
    }),
    prisma.academicYear.findFirst({
      where: { schoolId: user.schoolId, isCurrent: true },
      select: { label: true },
    }),
    // Pour créer la classe depuis l'import : les niveaux de l'école, toutes
    // années confondues (voir buildCatalog).
    prisma.classRoom.findMany({
      where: { schoolId: user.schoolId },
      distinct: ["category", "level"],
      select: { category: true, level: true, name: true },
    }),
    loadTuitionSettings(user.schoolId),
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
      photoUrl: null,
      placeOfBirth: s.placeOfBirth,
      nationality: s.nationality,
      nni: s.nni,
      rimNumber: s.rimNumber,
      matricule: s.matricule,
      motherName: s.motherName,
      tuition: null,
      money: null,
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

  // Classe d'un lien (?classe=…) ou famille (?famille=…) inconnues : ignorées.
  const classFilter =
    state.classFilter === "ALL" || state.classFilter === "NONE" || classes.some((c) => c.id === state.classFilter)
      ? state.classFilter
      : "ALL";
  const family = state.family && rows.some((r) => r.parent?.id === state.family) ? state.family : null;
  const current = { ...state, classFilter, family };
  const list = pageOf(filterStudents(rows, current), state.page, STUDENTS_PAGE_SIZE);
  // Photos, formule et argent : pour les élèves de la page seulement, pas pour toute l'école.
  const pageIds = list.rows.map((r) => r.id);
  const [photoOf, tuition, money] = pageIds.length
    ? await Promise.all([
        loadStudentPhotos(user.schoolId, pageIds),
        tuitionSummaries(user.schoolId, pageIds),
        studentMoneySummaries(user.schoolId, pageIds),
      ])
    : [new Map<string, string | null>(), new Map(), new Map()];

  return (
    <StudentsView
      state={{ ...current, page: list.page }}
      students={list.rows.map((r) => ({
        ...r,
        photoUrl: photoOf.get(r.id) ?? null,
        tuition: tuition.get(r.id) ?? null,
        money: money.get(r.id) ?? null,
      }))}
      total={list.total}
      pageCount={list.pageCount}
      hasStudents={rows.length > 0}
      letters={lettersOf(rows.map((r) => `${r.firstName} ${r.lastName}`))}
      // Seuls les élèves actifs comptent : un élève transféré ou diplômé n'a
      // pas vocation à porter une classe, le signaler serait un faux positif.
      unassignedCount={rows.filter((r) => r.className == null && r.status === "ACTIVE").length}
      familyParent={family ? (rows.find((r) => r.parent?.id === family)?.parent ?? null) : null}
      classes={classOptions(classes)}
      catalog={buildCatalog(allLevels)}
      tuitionSettings={tuitionSettings}
      draftKey={`eleve-${user.schoolId}`}
      schoolName={school?.name ?? "Madrasati"}
      currentYearLabel={currentYear?.label ?? null}
      autoOpenNew={openNew === "1"}
    />
  );
}
