import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { dueFeesOf } from "@/lib/due-rule-data";
import { FEATURES, schoolHasFeature } from "@/lib/plans";
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
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true, plan: true, subscriptionStatus: true } }),
  ]);

  const bilingual = schoolHasFeature(school, FEATURES.BILINGUAL_MESSAGES);

  // Reste dû par élève : c'est la donnée qui manquait au modèle « Rappel de
  // paiement », dont le montant partait vide. Calculé ici plutôt que côté
  // navigateur, pour ne pas exposer toute la finance de l'école au client.
  // Ce qui est dû aujourd'hui, selon le jour limite et la tolérance de
  // l'école : pas les mois à venir d'une formule de paiement.
  const fees = await dueFeesOf(user.schoolId);
  const outstandingByStudent = new Map<string, number>();
  // L'échéance non réglée la plus ancienne : la date du rappel de paiement.
  const oldestDueByStudent = new Map<string, Date>();
  for (const fee of fees) {
    outstandingByStudent.set(fee.studentId, (outstandingByStudent.get(fee.studentId) ?? 0) + fee.remaining);
    const oldest = oldestDueByStudent.get(fee.studentId);
    if (!oldest || fee.payBy < oldest) oldestDueByStudent.set(fee.studentId, fee.payBy);
  }

  const recipients: Recipient[] = [
    ...parents.map((p) => {
      const children = p.studentLinks.map((l) => ({
        name: `${l.student.firstName} ${l.student.lastName}`.trim(),
        outstanding: outstandingByStudent.get(l.studentId) ?? 0,
        oldestDue: oldestDueByStudent.get(l.studentId)?.toISOString() ?? null,
      }));
      return {
        id: `parent-${p.id}`,
        name: `${p.firstName} ${p.lastName}`.trim(),
        phone: p.phone,
        kind: "PARENT" as const,
        children,
      };
    }),
    ...teachers.map((t) => ({
      id: `teacher-${t.id}`,
      name: `${t.firstName} ${t.lastName}`.trim(),
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
