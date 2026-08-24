"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { generateReceiptNumber, runWithReceipt } from "@/lib/receipts";
import { feeSchema, paymentSchema, type FeeFormValues, type PaymentFormValues } from "./schema";

export async function createFee(values: FeeFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = feeSchema.parse(values);

  // L'élève doit appartenir à l'école de l'appelant : sans ce contrôle, un
  // studentId d'une autre école créerait un frais (et une fuite de nom/
  // classe/téléphone parent via la page Finance) sur un élève qui n'est pas
  // le sien.
  const student = await prisma.student.findFirst({
    where: { id: data.studentId, schoolId: user.schoolId },
  });
  if (!student) throw new Error("Élève introuvable.");

  const academicYear = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isCurrent: true },
  });
  if (!academicYear) throw new Error("Aucune année scolaire active.");

  await prisma.fee.create({
    data: {
      schoolId: user.schoolId,
      studentId: student.id,
      academicYearId: academicYear.id,
      label: data.label,
      amount: data.amount,
      dueDate: new Date(data.dueDate),
      status: "PENDING",
    },
  });

  revalidatePath("/directeur/finance");
  revalidatePath("/directeur");
}

export async function recordPayment(feeId: string, values: PaymentFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = paymentSchema.parse(values);

  const fee = await prisma.fee.findFirst({
    where: { id: feeId, schoolId: user.schoolId },
  });
  if (!fee) throw new Error("Frais introuvable.");

  // La création du reçu et le recalcul du statut doivent réussir ou échouer
  // ensemble, sinon deux paiements simultanés peuvent tous les deux lire
  // « 0 déjà payé » et poser un statut PARTIAL alors que le frais est en
  // réalité soldé. Le réessai sur collision de numéro est mutualisé dans
  // runWithReceipt, partagé avec l'inscription et la réinscription.
  const paymentId = await runWithReceipt(async (tx, attempt) => {
    const receiptNumber = await generateReceiptNumber(tx, user.schoolId, attempt);

    const payment = await tx.payment.create({
      data: {
        schoolId: user.schoolId,
        feeId: fee.id,
        studentId: fee.studentId,
        amount: data.amount,
        method: data.method,
        note: data.note || null,
        receiptNumber,
        recordedByUserId: user.id,
      },
    });

    const totalPaid = await tx.payment.aggregate({
      where: { feeId: fee.id },
      _sum: { amount: true },
    });
    const paid = totalPaid._sum.amount ?? 0;
    const nextStatus = paid >= fee.amount ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING";

    await tx.fee.update({ where: { id: fee.id }, data: { status: nextStatus } });

    return payment.id;
  });

  revalidatePath("/directeur/finance");
  revalidatePath("/directeur");
  return { paymentId };
}

/**
 * Supprime un frais créé par erreur — un doublon de saisie, un montant posé
 * sur le mauvais élève.
 *
 * Refusé dès qu'un paiement y est rattaché, et ce n'est pas une précaution de
 * confort : en base, les paiements d'un frais sont supprimés avec lui
 * (onDelete: Cascade). Effacer un frais réglé emporterait donc silencieusement
 * les reçus déjà remis aux parents, avec leurs numéros — des pièces
 * comptables que l'école ne peut plus reconstituer. Le trop-perçu se corrige
 * en modifiant le frais, jamais en le faisant disparaître.
 */
export async function deleteFee(feeId: string) {
  const user = await requireRole(ROLES.DIRECTOR);

  const fee = await prisma.fee.findFirst({
    where: { id: feeId, schoolId: user.schoolId },
    select: { id: true, _count: { select: { payments: true } } },
  });
  if (!fee) throw new Error("Frais introuvable.");

  if (fee._count.payments > 0) {
    throw new Error(
      fee._count.payments === 1
        ? "Ce frais porte déjà un paiement : le supprimer effacerait son reçu."
        : `Ce frais porte déjà ${fee._count.payments} paiements : les supprimer effacerait leurs reçus.`,
    );
  }

  await prisma.fee.delete({ where: { id: fee.id } });

  revalidatePath("/directeur/finance");
  revalidatePath("/directeur");
}
