import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { FEATURES, schoolHasFeature } from "@/lib/plans";
import { formatAmount } from "@/lib/format";
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
  const [fees, payments] = await Promise.all([
    prisma.fee.findMany({
      where: { schoolId: user.schoolId, status: { not: "PAID" } },
      select: { id: true, studentId: true, amount: true },
    }),
    prisma.payment.groupBy({
      by: ["feeId"],
      where: { schoolId: user.schoolId },
      _sum: { amount: true },
    }),
  ]);
  const paidByFee = new Map(payments.map((p) => [p.feeId, p._sum.amount ?? 0]));
  const outstandingByStudent = new Map<string, number>();
  for (const fee of fees) {
    const remaining = fee.amount - (paidByFee.get(fee.id) ?? 0);
    if (remaining > 0) {
      outstandingByStudent.set(
        fee.studentId,
        (outstandingByStudent.get(fee.studentId) ?? 0) + remaining,
      );
    }
  }

  const recipients: Recipient[] = [
    ...parents.map((p) => {
      const children = p.studentLinks.map((l) => ({
        name: `${l.student.firstName} ${l.student.lastName}`,
        // Le format ne porte pas « MRU » : les modèles écrivent déjà l'unité
        // eux-mêmes (« {amount} MRU », « {amount} أوقية موريتانية »).
        outstanding: outstandingByStudent.get(l.studentId)
          ? formatAmount(outstandingByStudent.get(l.studentId)!)
          : null,
      }));
      return {
        id: `parent-${p.id}`,
        name: `${p.firstName} ${p.lastName}`,
        phone: p.phone,
        kind: "PARENT" as const,
        children,
      };
    }),
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
