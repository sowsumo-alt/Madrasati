import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { FEATURES, schoolHasFeature } from "@/lib/plans";
import { ExamsView, type ExamRow } from "./exams-view";
import type { ExamClassOption } from "./exam-form-dialog";

export default async function ExamsPage() {
  const user = await requireRole(ROLES.DIRECTOR);

  const [exams, classes, students, school] = await Promise.all([
    prisma.exam.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { date: "desc" },
      include: {
        classRoom: { select: { name: true } },
        subject: { select: { name: true } },
        grades: true,
      },
    }),
    prisma.classRoom.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { name: "asc" },
      include: {
        classSubjects: { include: { subject: { select: { id: true, name: true } } } },
      },
    }),
    prisma.student.findMany({
      where: { schoolId: user.schoolId, status: "ACTIVE" },
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

  const examRows: ExamRow[] = exams.map((e) => {
    const classStudents = students.filter((s) => s.classId === e.classId);
    const gradeByStudent = new Map(e.grades.map((g) => [g.studentId, g]));

    const scores = e.grades
      .filter((g) => !g.isAbsent && g.score != null)
      .map((g) => g.score as number);
    const average =
      scores.length > 0 ? scores.reduce((sum, n) => sum + n, 0) / scores.length : null;

    return {
      id: e.id,
      title: e.title,
      term: e.term,
      date: e.date.toISOString(),
      durationMinutes: e.durationMinutes,
      maxScore: e.maxScore,
      classId: e.classId,
      className: e.classRoom.name,
      subjectName: e.subject.name,
      gradedCount: e.grades.filter((g) => g.score != null || g.isAbsent).length,
      studentCount: classStudents.length,
      average,
      students: classStudents.map((s) => {
        const grade = gradeByStudent.get(s.id);
        const parent = s.parentLinks[0]?.parent;
        return {
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          score: grade?.score ?? null,
          isAbsent: grade?.isAbsent ?? false,
          parentName: parent ? `${parent.firstName} ${parent.lastName}` : null,
          parentPhone: parent?.phone ?? null,
        };
      }),
    };
  });

  const classOptions: ExamClassOption[] = classes.map((c) => ({
    id: c.id,
    name: c.name,
    subjects: c.classSubjects.map((cs) => ({
      id: cs.subject.id,
      name: cs.subject.name,
    })),
  }));

  return (
    <ExamsView
      exams={examRows}
      classes={classOptions}
      schoolName={school?.name ?? "Madrasati"}
      bilingual={bilingual}
    />
  );
}
