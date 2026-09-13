import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { getTeacherScope } from "@/lib/teacher-scope";
import { FEATURES, schoolHasFeature } from "@/lib/plans";
import { ExamsView } from "@/app/directeur/examens/exams-view";
import type { ExamClassOption } from "@/app/directeur/examens/exam-form-dialog";
import { EXAM_ROW_INCLUDE, toExamRows } from "@/app/directeur/examens/exam-rows";

export default async function TeacherGradesPage({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string }>;
}) {
  const user = await requireRole(ROLES.TEACHER);
  const { exam: initialExamId } = await searchParams;
  const scope = await getTeacherScope(user.id, user.schoolId);
  const classIds = scope?.currentClassIds ?? [];

  const [exams, classes, students, school] = await Promise.all([
    prisma.exam.findMany({
      where: { schoolId: user.schoolId, classId: { in: classIds } },
      orderBy: [{ date: "desc" }, { startMinutes: "asc" }],
      include: EXAM_ROW_INCLUDE,
    }),
    prisma.classRoom.findMany({
      where: { id: { in: classIds } },
      orderBy: { name: "asc" },
      include: {
        classSubjects: {
          include: { subject: { select: { id: true, name: true, coefficient: true } } },
        },
      },
    }),
    prisma.student.findMany({
      where: { schoolId: user.schoolId, classId: { in: classIds }, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        classId: true,
        parentLinks: {
          where: { isPrimary: true },
          include: { parent: { select: { firstName: true, lastName: true, phone: true } } },
          take: 1,
        },
      },
    }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true, plan: true, subscriptionStatus: true } }),
  ]);

  const bilingual = schoolHasFeature(school, FEATURES.BILINGUAL_MESSAGES);

  const classOptions: ExamClassOption[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    subjects: c.classSubjects.map((cs) => ({
      id: cs.subject.id,
      name: cs.subject.name,
      coefficient: cs.coefficientOverride ?? cs.subject.coefficient,
    })),
  }));

  return (
    <ExamsView
      exams={toExamRows(exams, students, new Date())}
      classes={classOptions}
      canManageExams={false}
      schoolName={school?.name ?? "Madrasati"}
      bilingual={bilingual}
      initialExamId={initialExamId ?? null}
    />
  );
}
