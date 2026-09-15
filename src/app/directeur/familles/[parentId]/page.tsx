import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { familyBalance, familyLabel } from "@/lib/family";
import { getTranslations } from "@/lib/i18n/server";
import { FamilyView } from "../family-view/family-view";
import type { AttachCandidate, FamilyHistoryEntry, FamilyPageData } from "../family-view/types";

/** « +22246523896 » et « 22246523896 » désignent le même numéro. */
function phoneVariants(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return [digits, `+${digits}`];
}

/**
 * Fiche d'une famille : le parent ou tuteur, tous ses enfants avec leur
 * classe, la situation financière de l'ensemble et l'historique des
 * paiements — familiaux et individuels.
 */
export default async function FamilyPage({ params }: { params: Promise<{ parentId: string }> }) {
  const { parentId } = await params;
  const user = await requireRole(ROLES.DIRECTOR);

  const parent = await prisma.parent.findFirst({
    where: { id: parentId, schoolId: user.schoolId },
    include: {
      studentLinks: {
        include: {
          student: {
            include: {
              classRoom: { select: { name: true } },
              fees: {
                orderBy: { dueDate: "asc" },
                include: {
                  payments: {
                    select: {
                      id: true,
                      amount: true,
                      method: true,
                      receiptNumber: true,
                      paidAt: true,
                      familyPaymentId: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      familyPayments: {
        include: { payments: { select: { student: { select: { firstName: true } } } } },
      },
    },
  });
  if (!parent) notFound();

  const { t } = await getTranslations();
  const students = parent.studentLinks
    .map((l) => l.student)
    .sort((a, b) => a.firstName.localeCompare(b.firstName, "fr"));
  const childIds = new Set(students.map((s) => s.id));

  const children = students.map((s) => {
    const balance = familyBalance(
      s.fees.map((f) => ({ amount: f.amount, totalPaid: f.payments.reduce((sum, p) => sum + p.amount, 0) })),
    );
    return {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      photoUrl: s.photoUrl,
      className: s.classRoom?.name ?? null,
      status: s.status,
      ...balance,
    };
  });

  const openFees = students.flatMap((s) =>
    s.fees
      .map((f) => ({
        feeId: f.id,
        studentId: s.id,
        studentName: `${s.firstName} ${s.lastName}`,
        className: s.classRoom?.name ?? null,
        label: f.label,
        remaining: Math.max(f.amount - f.payments.reduce((sum, p) => sum + p.amount, 0), 0),
      }))
      .filter((f) => f.remaining > 0),
  );

  // Historique : chaque paiement familial une fois (avec ses enfants), puis
  // les paiements faits pour un seul enfant.
  const history: FamilyHistoryEntry[] = [
    ...parent.familyPayments.map((fp) => ({
      kind: "family" as const,
      id: fp.id,
      receiptNumber: fp.receiptNumber,
      paidAt: fp.paidAt.toISOString(),
      method: fp.method,
      total: fp.total,
      childNames: fp.payments.map((p) => p.student.firstName),
    })),
    ...students.flatMap((s) =>
      s.fees.flatMap((f) =>
        f.payments
          .filter((p) => !p.familyPaymentId)
          .map((p) => ({
            kind: "single" as const,
            id: p.id,
            receiptNumber: p.receiptNumber,
            paidAt: p.paidAt.toISOString(),
            method: p.method,
            total: p.amount,
            childName: `${s.firstName} ${s.lastName}`,
            feeLabel: f.label,
          })),
      ),
    ),
  ].sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  // Frères et sœurs inscrits sous une autre fiche parent portant le même
  // numéro : proposés au rattachement, sans rien ressaisir.
  const [samePhone, others] = await Promise.all([
    prisma.student.findMany({
      where: {
        schoolId: user.schoolId,
        id: { notIn: [...childIds] },
        parentLinks: {
          some: { parent: { phone: { in: phoneVariants(parent.phone) }, id: { not: parent.id } } },
        },
      },
      include: {
        classRoom: { select: { name: true } },
        parentLinks: { where: { isPrimary: true }, take: 1, include: { parent: true } },
      },
    }),
    prisma.student.findMany({
      where: { schoolId: user.schoolId, status: "ACTIVE", id: { notIn: [...childIds] } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      include: {
        classRoom: { select: { name: true } },
        parentLinks: { where: { isPrimary: true }, take: 1, include: { parent: true } },
      },
    }),
  ]);

  const toCandidate = (s: (typeof others)[number]): AttachCandidate => {
    const p = s.parentLinks[0]?.parent;
    return {
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      className: s.classRoom?.name ?? null,
      parentName: p ? `${p.firstName} ${p.lastName}` : null,
    };
  };

  const data: FamilyPageData = {
    parentId: parent.id,
    familyName: parent.familyName,
    label: familyLabel(parent, t("family.defaultName")),
    parent: {
      firstName: parent.firstName,
      lastName: parent.lastName,
      phone: parent.phone,
      address: parent.address,
      relationship: parent.relationship,
    },
    children,
    openFees,
    history,
    // Somme des restes dus de chaque enfant (eux-mêmes calculés frais par
    // frais) : un trop-perçu chez l'un ne comble pas la dette d'un autre.
    balance: children.reduce(
      (acc, c) => ({ billed: acc.billed + c.billed, paid: acc.paid + c.paid, due: acc.due + c.due }),
      { billed: 0, paid: 0, due: 0 },
    ),
    suggestions: samePhone.map(toCandidate),
    candidates: others.map(toCandidate),
  };

  return <FamilyView data={data} />;
}
