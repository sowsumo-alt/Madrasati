import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { buildReportCards } from "@/lib/report-card-data";
import { TERMS } from "@/app/directeur/examens/schema";
import { BulletinsView, type BulletinRow } from "./bulletins-view";

const DEFAULT_GRADES_TEMPLATE =
  "Bonjour {parentName},\n\nLes notes de {studentName} sont désormais disponibles (moyenne générale : {average}/20). N'hésitez pas à nous contacter pour en discuter.\n\n{schoolName}";
const DEFAULT_GRADES_TEMPLATE_AR =
  "مرحبًا {parentName}،\n\nأصبح كشف نقاط {studentName} متوفرًا الآن (المعدل العام: {average}/20). لا تترددوا في الاتصال بنا لمناقشته.\n\n{schoolName}";

export default async function BulletinsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; term?: string }>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const params = await searchParams;

  const classes = await prisma.classRoom.findMany({
    where: { schoolId: user.schoolId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const selectedClassId =
    params.classId && classes.some((c) => c.id === params.classId)
      ? params.classId
      : (classes[0]?.id ?? "");
  const selectedTerm =
    params.term && (TERMS as readonly string[]).includes(params.term)
      ? params.term
      : TERMS[0];

  const [cards, parents, school, template] = await Promise.all([
    selectedClassId
      ? buildReportCards(user.schoolId, selectedClassId, selectedTerm)
      : Promise.resolve([]),
    prisma.studentParent.findMany({
      where: { isPrimary: true, student: { schoolId: user.schoolId } },
      include: { parent: true },
    }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }),
    prisma.messageTemplate.findFirst({
      where: { schoolId: user.schoolId, key: "GRADES_AVAILABLE" },
      select: { body: true, bodyAr: true },
    }),
  ]);

  const parentByStudent = new Map(parents.map((p) => [p.studentId, p.parent]));

  const rows: BulletinRow[] = cards.map((c) => {
    const parent = parentByStudent.get(c.student.id);
    return {
      studentId: c.student.id,
      studentName: `${c.student.firstName} ${c.student.lastName}`,
      average: c.average,
      mention: c.mention,
      rank: c.rank,
      classSize: c.classSize,
      subjectsScored: c.results.filter((r) => r.average != null).length,
      parent: parent
        ? {
            firstName: parent.firstName,
            lastName: parent.lastName,
            phone: parent.phone,
          }
        : null,
    };
  });

  return (
    <BulletinsView
      rows={rows}
      classes={classes}
      terms={[...TERMS]}
      selectedClassId={selectedClassId}
      selectedTerm={selectedTerm}
      schoolName={school?.name ?? "Madrasati"}
      gradesTemplate={template?.body ?? DEFAULT_GRADES_TEMPLATE}
      gradesTemplateAr={template?.bodyAr ?? DEFAULT_GRADES_TEMPLATE_AR}
    />
  );
}
