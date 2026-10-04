"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { familyPartReceiptNumber, generateReceiptNumber, runWithReceipt } from "@/lib/receipts";
import { allocateOldestFirst } from "@/lib/tuition";
import { formatMRU } from "@/lib/format";
import {
  feeEditSchema,
  feeSchema,
  paymentSchema,
  type FeeEditValues,
  type FeeFormValues,
  type PaymentFormValues,
} from "./schema";

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

/**
 * Corrige un frais : libellé, montant ou échéance. Le statut enregistré est
 * recalculé sur les paiements déjà reçus — ramener le montant sous ce qui a
 * été versé solde le frais, sans créer de dette négative.
 */
export async function updateFee(feeId: string, values: FeeEditValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = feeEditSchema.parse(values);

  const fee = await prisma.fee.findFirst({
    where: { id: feeId, schoolId: user.schoolId },
    select: { id: true },
  });
  if (!fee) throw new Error("Frais introuvable.");

  // Même transaction que l'enregistrement d'un paiement : un versement reçu
  // pendant la correction ne doit pas laisser un statut calculé sur un total
  // déjà dépassé.
  await prisma.$transaction(async (tx) => {
    const totalPaid = await tx.payment.aggregate({
      where: { feeId: fee.id },
      _sum: { amount: true },
    });
    const paid = totalPaid._sum.amount ?? 0;
    await tx.fee.update({
      where: { id: fee.id },
      data: {
        label: data.label,
        amount: data.amount,
        dueDate: new Date(data.dueDate),
        status: paid >= data.amount ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING",
      },
    });
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

  // Échéance d'une formule de paiement : le versement règle les mois de la
  // plus ancienne à la plus récente, quelle que soit la ligne cliquée, et
  // couvre plusieurs mois s'il le faut — un seul reçu pour le tout.
  if (fee.tuitionPlanId) {
    const tuitionPlanId = fee.tuitionPlanId;
    const paymentId = await runWithReceipt(async (tx, attempt) => {
      const installments = await tx.fee.findMany({
        where: { tuitionPlanId, schoolId: user.schoolId },
        orderBy: [{ periodStart: "asc" }, { dueDate: "asc" }],
        select: { id: true, amount: true, payments: { select: { amount: true } } },
      });
      const open = installments.map((f) => ({
        id: f.id,
        amount: f.amount,
        paid: f.payments.reduce((sum, p) => sum + p.amount, 0),
      }));
      const parts = allocateOldestFirst(
        open.map((f) => ({ ...f, remaining: f.amount - f.paid })),
        data.amount,
      );
      const covered = parts.reduce((sum, p) => sum + p.amount, 0);
      if (covered < data.amount) {
        throw new Error(
          `Le montant dépasse ce qui reste à payer pour l'année (${formatMRU(covered)}).`,
        );
      }

      const receiptNumber = await generateReceiptNumber(tx, user.schoolId, attempt);
      let familyPaymentId: string | null = null;
      if (parts.length > 1) {
        const parent = await tx.studentParent.findFirst({
          where: { studentId: fee.studentId, isPrimary: true },
          select: { parentId: true },
        });
        familyPaymentId = (
          await tx.familyPayment.create({
            data: {
              schoolId: user.schoolId,
              parentId: parent?.parentId ?? null,
              receiptNumber,
              total: data.amount,
              method: data.method,
              note: data.note || null,
              recordedByUserId: user.id,
            },
          })
        ).id;
      }

      let firstId = "";
      for (const [index, part] of parts.entries()) {
        const payment = await tx.payment.create({
          data: {
            schoolId: user.schoolId,
            feeId: part.item.id,
            studentId: fee.studentId,
            amount: part.amount,
            method: data.method,
            note: data.note || null,
            receiptNumber: familyPaymentId ? familyPartReceiptNumber(receiptNumber, index + 1) : receiptNumber,
            familyPaymentId,
            recordedByUserId: user.id,
          },
        });
        firstId ||= payment.id;
        const paid = part.item.paid + part.amount;
        await tx.fee.update({
          where: { id: part.item.id },
          data: { status: paid >= part.item.amount ? "PAID" : "PARTIAL" },
        });
      }
      return firstId;
    });

    revalidatePath("/directeur/finance");
    revalidatePath("/directeur");
    return { paymentId };
  }

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

/**
 * Note les reçus imprimés : en impression « deux reçus par feuille », un
 * reçu déjà sorti ne revient plus en bas de la feuille suivante.
 */
export async function markReceiptsPrinted(paymentIds: string[]) {
  const user = await requireRole(ROLES.DIRECTOR);
  await prisma.payment.updateMany({
    where: { id: { in: paymentIds.slice(0, 10) }, schoolId: user.schoolId, receiptPrintedAt: null },
    data: { receiptPrintedAt: new Date() },
  });
}
