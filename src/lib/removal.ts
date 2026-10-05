import type { Prisma } from "@prisma/client";
import { reattachFamilySheets } from "@/lib/family-sheet-data";

/**
 * Supprimer ou archiver des élèves et des familles.
 *
 * Archiver (recommandé dès qu'il y a de l'argent) : l'élève passe « Retiré »,
 * tout son historique reste — notes, paiements, reçus. Si c'est l'élève
 * référent d'une fiche familiale, la fiche passe à un autre enfant actif.
 *
 * Supprimer définitivement (données de test) : l'élève disparaît avec ses
 * échéances, paiements, reçus (y compris annulés), notes et présences — la
 * base les supprime en cascade. Un reçu familial qui couvrait aussi d'autres
 * enfants garde leurs parts, avec son total recalculé ; vide, il disparaît.
 * Aucune ligne orpheline.
 */

export { sameName } from "@/lib/removal-name";

export async function archiveStudents(tx: Prisma.TransactionClient, schoolId: string, studentIds: string[]) {
  await tx.student.updateMany({ where: { id: { in: studentIds }, schoolId }, data: { status: "INACTIVE" } });
  await reattachFamilySheets(tx, studentIds);
}

export async function deleteStudents(tx: Prisma.TransactionClient, schoolId: string, studentIds: string[]) {
  const ids = (
    await tx.student.findMany({ where: { id: { in: studentIds }, schoolId }, select: { id: true } })
  ).map((s) => s.id);
  if (ids.length === 0) return { students: 0 };

  // La fiche familiale d'abord : elle passe à un enfant qui reste, s'il y en a.
  await archiveStudents(tx, schoolId, ids);

  // Reçus familiaux touchés : recalculés après la suppression.
  const touched = await tx.payment.findMany({
    where: { studentId: { in: ids }, familyPaymentId: { not: null } },
    select: { familyPaymentId: true },
  });
  const groupIds = [...new Set(touched.map((p) => p.familyPaymentId!))];

  await tx.cancelledPayment.deleteMany({ where: { studentId: { in: ids } } });
  await tx.student.deleteMany({ where: { id: { in: ids } } });

  for (const id of groupIds) {
    const left = await tx.payment.aggregate({ where: { familyPaymentId: id }, _sum: { amount: true }, _count: true });
    if (left._count === 0) {
      await tx.cancelledPayment.updateMany({ where: { familyPaymentId: id }, data: { familyPaymentId: null } });
      await tx.familyPayment.delete({ where: { id } });
    } else {
      await tx.familyPayment.update({ where: { id }, data: { total: left._sum.amount ?? 0 } });
    }
  }
  return { students: ids.length };
}

/** Supprime une famille de test : ses enfants (voir deleteStudents), ses reçus, son compte parent. */
export async function deleteFamily(tx: Prisma.TransactionClient, schoolId: string, parentId: string) {
  const parent = await tx.parent.findFirst({
    where: { id: parentId, schoolId },
    select: { id: true, userId: true, studentLinks: { select: { studentId: true } } },
  });
  if (!parent) return { students: 0 };
  // Seuls les enfants qui n'appartiennent à aucune autre famille partent avec elle.
  const childIds = parent.studentLinks.map((l) => l.studentId);
  const shared = await tx.studentParent.findMany({
    where: { studentId: { in: childIds }, parentId: { not: parent.id } },
    select: { studentId: true },
  });
  const sharedIds = new Set(shared.map((s) => s.studentId));
  const result = await deleteStudents(tx, schoolId, childIds.filter((id) => !sharedIds.has(id)));

  const groups = await tx.familyPayment.findMany({ where: { parentId: parent.id }, select: { id: true } });
  await tx.cancelledPayment.deleteMany({ where: { familyPaymentId: { in: groups.map((g) => g.id) } } });
  await tx.payment.deleteMany({ where: { familyPaymentId: { in: groups.map((g) => g.id) } } });
  await tx.familyPayment.deleteMany({ where: { parentId: parent.id } });
  await tx.parent.delete({ where: { id: parent.id } });
  if (parent.userId) await tx.user.deleteMany({ where: { id: parent.userId, role: "PARENT" } });
  return result;
}
