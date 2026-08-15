import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { getTeacherScope } from "@/lib/teacher-scope";
import {
  AttendanceView,
  type AttendanceStudent,
} from "@/app/directeur/presences/attendance-view";

const DEFAULT_ABSENCE_TEMPLATE =
  "Bonjour {parentName}, nous vous informons que {studentName} est absent(e) aujourd'hui ({date}). Merci de nous contacter si besoin. École {schoolName}.";
const DEFAULT_ABSENCE_TEMPLATE_AR =
  "مرحبًا {parentName}، نعلمكم بأن {studentName} غائب(ة) اليوم ({date}). يرجى الاتصال بنا عند الحاجة. مدرسة {schoolName}.";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function TeacherAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; date?: string }>;
}) {
  const user = await requireRole(ROLES.TEACHER);
  const params = await searchParams;
  const scope = await getTeacherScope(user.id, user.schoolId);

  // Seules les classes de l'enseignant sont proposées — et le sélecteur ne
  // peut donc jamais pointer vers la classe d'un collègue.
  const classes = scope
    ? await prisma.classRoom.findMany({
        where: { id: { in: scope.classIds } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  const selectedClassId =
    params.classId && classes.some((c) => c.id === params.classId)
      ? params.classId
      : (classes[0]?.id ?? "");
  const selectedDate = params.date ?? todayISO();
  const date = new Date(`${selectedDate}T00:00:00.000Z`);

  const [students, records, todayRecords, school, template] = await Promise.all([
    selectedClassId
      ? prisma.student.findMany({
          where: { schoolId: user.schoolId, classId: selectedClassId, status: "ACTIVE" },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          include: {
            parentLinks: { where: { isPrimary: true }, include: { parent: true }, take: 1 },
          },
        })
      : Promise.resolve([]),
    selectedClassId
      ? prisma.attendanceRecord.groupBy({
          by: ["studentId", "status"],
          where: { schoolId: user.schoolId, classId: selectedClassId },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    selectedClassId
      ? prisma.attendanceRecord.findMany({
          where: { schoolId: user.schoolId, classId: selectedClassId, date },
          select: { studentId: true, status: true },
        })
      : Promise.resolve([]),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }),
    prisma.messageTemplate.findFirst({
      where: { schoolId: user.schoolId, key: "ABSENCE_ALERT" },
      select: { body: true, bodyAr: true },
    }),
  ]);

  const totalsByStudent = new Map<string, { present: number; total: number }>();
  for (const r of records) {
    const entry = totalsByStudent.get(r.studentId) ?? { present: 0, total: 0 };
    entry.total += r._count._all;
    if (r.status === "PRESENT" || r.status === "LATE") {
      entry.present += r._count._all;
    }
    totalsByStudent.set(r.studentId, entry);
  }

  const studentRows: AttendanceStudent[] = students.map((s) => {
    const totals = totalsByStudent.get(s.id);
    const rate =
      totals && totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : 100;
    return {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      attendanceRate: rate,
      parent: s.parentLinks[0]
        ? {
            firstName: s.parentLinks[0].parent.firstName,
            lastName: s.parentLinks[0].parent.lastName,
            phone: s.parentLinks[0].parent.phone,
          }
        : null,
    };
  });

  const existingRecords: Record<string, string> = {};
  for (const r of todayRecords) existingRecords[r.studentId] = r.status;

  return (
    <AttendanceView
      classes={classes}
      students={studentRows}
      existingRecords={existingRecords}
      selectedClassId={selectedClassId}
      selectedDate={selectedDate}
      schoolName={school?.name ?? "Madrasati"}
      absenceTemplate={template?.body ?? DEFAULT_ABSENCE_TEMPLATE}
      absenceTemplateAr={template?.bodyAr ?? DEFAULT_ABSENCE_TEMPLATE_AR}
      basePath="/enseignant/presences"
    />
  );
}
