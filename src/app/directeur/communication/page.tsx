import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { FEATURES, planHasFeature } from "@/lib/plans";
import { CommunicationView, type Recipient, type TemplateRow } from "./communication-view";

export default async function CommunicationPage() {
  const user = await requireRole(ROLES.DIRECTOR);

  const [parents, teachers, templates, school] = await Promise.all([
    prisma.parent.findMany({
      where: { schoolId: user.schoolId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { studentLinks: { include: { student: true } } },
    }),
    prisma.teacher.findMany({
      where: { schoolId: user.schoolId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.messageTemplate.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { title: "asc" },
    }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true, plan: true } }),
  ]);

  const bilingual = planHasFeature(school?.plan, FEATURES.BILINGUAL_MESSAGES);

  const recipients: Recipient[] = [
    ...parents.map((p) => ({
      id: `parent-${p.id}`,
      name: `${p.firstName} ${p.lastName}`,
      phone: p.phone,
      kind: "PARENT" as const,
      children: p.studentLinks.map(
        (l) => `${l.student.firstName} ${l.student.lastName}`,
      ),
    })),
    ...teachers.map((t) => ({
      id: `teacher-${t.id}`,
      name: `${t.firstName} ${t.lastName}`,
      phone: t.phone,
      kind: "TEACHER" as const,
      children: [],
    })),
  ];

  const templateRows: TemplateRow[] = templates.map((t) => ({
    id: t.id,
    key: t.key,
    title: t.title,
    body: t.body,
    bodyAr: bilingual ? t.bodyAr : null,
  }));

  return (
    <CommunicationView
      recipients={recipients}
      templates={templateRows}
      schoolName={school?.name ?? "Madrasati"}
    />
  );
}
