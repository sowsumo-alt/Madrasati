import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { FEATURES, schoolHasFeature } from "@/lib/plans";
import { ExamsView } from "./exams-view";
import type { ExamClassOption } from "./exam-form-dialog";
import { EXAM_ROW_INCLUDE, toExamRows } from "./exam-rows";
import { CURRENT_YEAR } from "@/lib/school-year";

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string }>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  // ?exam=<id> ouvre directement la saisie des notes de cet examen. C'est ce
  // qui permet d'y arriver en un clic depuis n'importe où, sans avoir à
  // retrouver la bonne ligne au milieu de la liste.
  const { exam: initialExamId } = await searchParams;

  const [exams, classes, students, school] = await Promise.all([
    prisma.exam.findMany({
      // Les examens de l'année écoulée n'ont rien à faire ici. Sans ce filtre,
      // la page proposait encore ceux de l'an dernier : le directeur y
      // saisissait des notes — qui s'enregistraient bel et bien — mais sur des
      // élèves d'une classe archivée, que la page Bulletins ne liste plus. Les
      // notes existaient et n'apparaissaient nulle part.
      where: { schoolId: user.schoolId, ...CURRENT_YEAR },
      orderBy: [{ date: "desc" }, { startMinutes: "asc" }],
      include: EXAM_ROW_INCLUDE,
    }),
    prisma.classRoom.findMany({
      where: { schoolId: user.schoolId, ...CURRENT_YEAR },
      orderBy: { name: "asc" },
      include: {
        classSubjects: {
          include: { subject: { select: { id: true, name: true, coefficient: true } } },
        },
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
      schoolName={school?.name ?? "Madrasati"}
      bilingual={bilingual}
      initialExamId={initialExamId ?? null}
    />
  );
}
