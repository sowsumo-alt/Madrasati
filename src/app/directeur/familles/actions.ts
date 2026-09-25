"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertNnisAvailable } from "@/lib/nni-data";
import { storedNni } from "@/lib/nni";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { familyPartReceiptNumber, generateReceiptNumber, runWithReceipt } from "@/lib/receipts";
import { DEFAULT_NATIONALITY, splitFullName } from "@/lib/student-form";
import { checkFamilyParts } from "@/lib/family";
import {
  familyEnrollmentSchema,
  familyPaymentSchema,
  type FamilyEnrollmentValues,
  type FamilyPaymentValues,
} from "./schema";

function revalidateFamilyPages(parentId?: string) {
  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur/parents");
  revalidatePath("/directeur/finance");
  revalidatePath("/directeur");
  if (parentId) revalidatePath(`/directeur/familles/${parentId}`);
}

/** Le même numéro, qu'il ait été enregistré avec ou sans « + ». */
function phoneVariants(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const local = digits.length === 8 ? `222${digits}` : digits;
  return [local, `+${local}`];
}

export interface KnownFamily {
  parentId: string;
  familyName: string | null;
  parentFirstName: string;
  parentLastName: string;
  address: string | null;
  children: { name: string; className: string | null }[];
}

/**
 * Familles déjà enregistrées avec ce numéro : l'inscription groupée propose
 * de les compléter plutôt que de créer une deuxième fiche pour le même parent.
 */
export async function findFamiliesByPhone(phone: string): Promise<KnownFamily[]> {
  const user = await requireRole(ROLES.DIRECTOR);
  if (phone.replace(/\D/g, "").length < 8) return [];

  const parents = await prisma.parent.findMany({
    where: { schoolId: user.schoolId, phone: { in: phoneVariants(phone) } },
    include: {
      studentLinks: {
        include: {
          student: { select: { firstName: true, lastName: true, classRoom: { select: { name: true } } } },
        },
      },
    },
    take: 5,
  });

  return parents.map((p) => ({
    parentId: p.id,
    familyName: p.familyName,
    parentFirstName: p.firstName,
    parentLastName: p.lastName,
    address: p.address,
    children: p.studentLinks.map((l) => ({
      name: `${l.student.firstName} ${l.student.lastName}`,
      className: l.student.classRoom?.name ?? null,
    })),
  }));
}

/** Recalcule le statut enregistré d'un frais après un versement. */
async function refreshFeeStatus(tx: Prisma.TransactionClient, feeId: string, amount: number) {
  const sum = await tx.payment.aggregate({ where: { feeId }, _sum: { amount: true } });
  const paid = sum._sum.amount ?? 0;
  const status = paid >= amount ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING";
  await tx.fee.update({ where: { id: feeId }, data: { status } });
}

export interface FamilyEnrollmentResult {
  parentId: string;
  studentIds: string[];
  /** Reçu unique de la famille, en paiement groupé. */
  familyPaymentId: string | null;
  /** Reçus individuels, en paiements séparés. */
  paymentIds: string[];
}

/**
 * Inscription groupée : un parent ou tuteur saisi une fois, plusieurs enfants,
 * un frais d'inscription propre à chacun — réglé en un seul paiement (un reçu
 * pour toute la famille) ou en paiements séparés (un reçu par enfant).
 *
 * Chaque enfant devient un élève ordinaire, rattaché à sa classe et à son
 * parent exactement comme par l'inscription individuelle : listes, appels,
 * bulletins et impayés n'ont rien de particulier à savoir.
 */
export async function enrollFamily(values: FamilyEnrollmentValues): Promise<FamilyEnrollmentResult> {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = familyEnrollmentSchema.parse(values);
  // Un NNI n'appartient qu'à un seul enfant, dans la saisie comme dans l'école.
  await assertNnisAvailable(user.schoolId, data.children.map((c) => c.nni));

  // Classes vérifiées d'un coup : un identifiant d'une autre école ferait
  // apparaître un élève dans une classe qui n'est pas la sienne.
  const classIds = [...new Set(data.children.map((c) => c.classId))];
  const classCount = await prisma.classRoom.count({
    where: { id: { in: classIds }, schoolId: user.schoolId },
  });
  if (classCount !== classIds.length) throw new Error("Classe introuvable.");

  const parentName = splitFullName(data.parentName);
  const withFee = data.children.some((c) => c.amount > 0);

  const result = await runWithReceipt(async (tx, attempt) => {
    // — Le parent : celui choisi, ou le même nom avec le même téléphone
    // (règle de l'inscription individuelle), ou une nouvelle fiche.
    let parent = data.existingParentId
      ? await tx.parent.findFirst({ where: { id: data.existingParentId, schoolId: user.schoolId } })
      : await tx.parent.findFirst({
          where: {
            schoolId: user.schoolId,
            phone: { in: phoneVariants(data.parentPhone) },
            firstName: { equals: parentName.firstName, mode: "insensitive" },
            lastName: { equals: parentName.lastName, mode: "insensitive" },
          },
        });
    if (data.existingParentId && !parent) throw new Error("Famille introuvable.");

    if (parent) {
      parent = await tx.parent.update({
        where: { id: parent.id },
        data: {
          familyName: data.familyName,
          // L'adresse complète une fiche qui n'en avait pas, sans jamais en
          // écraser une déjà saisie.
          ...(!parent.address && data.parentAddress ? { address: data.parentAddress } : {}),
        },
      });
    } else {
      parent = await tx.parent.create({
        data: {
          schoolId: user.schoolId,
          firstName: parentName.firstName,
          lastName: parentName.lastName,
          phone: data.parentPhone,
          address: data.parentAddress || null,
          relationship: "tuteur",
          familyName: data.familyName,
        },
      });
    }

    const year = withFee
      ? await tx.academicYear.findFirst({ where: { schoolId: user.schoolId, isCurrent: true } })
      : null;
    if (withFee && !year) throw new Error("Aucune année scolaire active.");

    // — Les enfants, chacun avec son frais d'inscription s'il y en a un.
    const now = new Date();
    const children: { studentId: string; feeId: string | null; amount: number }[] = [];
    for (const child of data.children) {
      const student = await tx.student.create({
        data: {
          schoolId: user.schoolId,
          firstName: child.firstName,
          lastName: child.lastName,
          dateOfBirth: child.dateOfBirth ? new Date(child.dateOfBirth) : null,
          gender: child.gender,
          placeOfBirth: child.placeOfBirth || null,
          nni: storedNni(child.nni),
          classId: child.classId,
          nationality: DEFAULT_NATIONALITY,
          status: "ACTIVE",
          enrollmentDate: now,
        },
      });
      await tx.studentParent.create({
        data: { studentId: student.id, parentId: parent.id, isPrimary: true },
      });

      let feeId: string | null = null;
      if (child.amount > 0 && year) {
        const fee = await tx.fee.create({
          data: {
            schoolId: user.schoolId,
            studentId: student.id,
            academicYearId: year.id,
            label: `Frais d'inscription — ${year.label}`,
            amount: child.amount,
            dueDate: now,
            status: "PAID",
          },
        });
        feeId = fee.id;
      }
      children.push({ studentId: student.id, feeId, amount: child.amount });
    }

    // — Le règlement : un reçu pour la famille, ou un reçu par enfant.
    const paid = children.filter((c) => c.feeId && c.amount > 0);
    let familyPaymentId: string | null = null;
    const paymentIds: string[] = [];

    if (paid.length > 0 && data.paymentMode === "FAMILY") {
      const receiptNumber = await generateReceiptNumber(tx, user.schoolId, attempt);
      const familyPayment = await tx.familyPayment.create({
        data: {
          schoolId: user.schoolId,
          parentId: parent.id,
          receiptNumber,
          total: paid.reduce((sum, c) => sum + c.amount, 0),
          method: data.method,
          paidAt: now,
          recordedByUserId: user.id,
        },
      });
      familyPaymentId = familyPayment.id;
      for (const [index, c] of paid.entries()) {
        const payment = await tx.payment.create({
          data: {
            schoolId: user.schoolId,
            feeId: c.feeId!,
            studentId: c.studentId,
            amount: c.amount,
            method: data.method,
            receiptNumber: familyPartReceiptNumber(receiptNumber, index + 1),
            familyPaymentId,
            paidAt: now,
            recordedByUserId: user.id,
          },
        });
        paymentIds.push(payment.id);
      }
    } else {
      // Chaque appel relit le plus grand numéro, y compris ceux que cette
      // transaction vient d'attribuer : les reçus se suivent.
      for (const c of paid) {
        const payment = await tx.payment.create({
          data: {
            schoolId: user.schoolId,
            feeId: c.feeId!,
            studentId: c.studentId,
            amount: c.amount,
            method: data.method,
            receiptNumber: await generateReceiptNumber(tx, user.schoolId, attempt),
            paidAt: now,
            recordedByUserId: user.id,
          },
        });
        paymentIds.push(payment.id);
      }
    }

    return {
      parentId: parent.id,
      studentIds: children.map((c) => c.studentId),
      familyPaymentId,
      paymentIds,
    };
  });

  revalidateFamilyPages(result.parentId);
  return result;
}

/**
 * Paiement familial après l'inscription : un seul versement du parent,
 * réparti entre les frais de ses enfants, avec un seul reçu. Chaque part
 * reste un paiement ordinaire du frais qu'elle règle.
 */
export async function recordFamilyPayment(
  parentId: string,
  values: FamilyPaymentValues,
): Promise<{ familyPaymentId: string }> {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = familyPaymentSchema.parse(values);
  const parts = data.parts.filter((p) => p.amount > 0);

  const parent = await prisma.parent.findFirst({
    where: { id: parentId, schoolId: user.schoolId },
    include: { studentLinks: { select: { studentId: true } } },
  });
  if (!parent) throw new Error("Famille introuvable.");
  const childIds = parent.studentLinks.map((l) => l.studentId);

  const familyPaymentId = await runWithReceipt(async (tx, attempt) => {
    // Les frais ne sont acceptés que s'ils appartiennent aux enfants de cette
    // famille ; le reste dû est relu dans la transaction, pas dans le
    // navigateur, pour qu'un autre encaissement entre-temps soit pris en compte.
    const fees = await tx.fee.findMany({
      where: {
        id: { in: parts.map((p) => p.feeId) },
        schoolId: user.schoolId,
        studentId: { in: childIds },
      },
      include: { payments: { select: { amount: true } } },
    });
    const remainingByFee = new Map(
      fees.map((f) => [f.id, Math.max(f.amount - f.payments.reduce((s, p) => s + p.amount, 0), 0)]),
    );
    const problem = checkFamilyParts(parts, remainingByFee);
    if (problem) throw new Error(problem);

    const receiptNumber = await generateReceiptNumber(tx, user.schoolId, attempt);
    const now = new Date();
    const familyPayment = await tx.familyPayment.create({
      data: {
        schoolId: user.schoolId,
        parentId,
        receiptNumber,
        total: parts.reduce((sum, p) => sum + p.amount, 0),
        method: data.method,
        note: data.note || null,
        paidAt: now,
        recordedByUserId: user.id,
      },
    });

    for (const [index, part] of parts.entries()) {
      const fee = fees.find((f) => f.id === part.feeId)!;
      await tx.payment.create({
        data: {
          schoolId: user.schoolId,
          feeId: fee.id,
          studentId: fee.studentId,
          amount: part.amount,
          method: data.method,
          note: data.note || null,
          receiptNumber: familyPartReceiptNumber(receiptNumber, index + 1),
          familyPaymentId: familyPayment.id,
          paidAt: now,
          recordedByUserId: user.id,
        },
      });
      await refreshFeeStatus(tx, fee.id, fee.amount);
    }

    return familyPayment.id;
  });

  revalidateFamilyPages(parentId);
  return { familyPaymentId };
}

/**
 * Rattache après coup un élève déjà inscrit à une famille — le frère ou la
 * sœur inscrit(e) seul(e), parfois sous une autre fiche parent. Rien n'est
 * ressaisi ni supprimé : la famille devient son contact principal, l'ancien
 * lien reste en contact secondaire.
 */
export async function attachStudentToFamily(parentId: string, studentId: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  const [parent, student] = await Promise.all([
    prisma.parent.findFirst({ where: { id: parentId, schoolId: user.schoolId }, select: { id: true } }),
    prisma.student.findFirst({ where: { id: studentId, schoolId: user.schoolId }, select: { id: true } }),
  ]);
  if (!parent || !student) throw new Error("Élève ou famille introuvable.");

  await prisma.$transaction([
    prisma.studentParent.updateMany({
      where: { studentId, parentId: { not: parentId } },
      data: { isPrimary: false },
    }),
    prisma.studentParent.upsert({
      where: { studentId_parentId: { studentId, parentId } },
      create: { studentId, parentId, isPrimary: true },
      update: { isPrimary: true },
    }),
  ]);

  revalidateFamilyPages(parentId);
}

/** Renomme la famille ; un nom vide revient à « Famille » + nom du parent. */
export async function renameFamily(parentId: string, familyName: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  const name = familyName.trim().slice(0, 80);
  const updated = await prisma.parent.updateMany({
    where: { id: parentId, schoolId: user.schoolId },
    data: { familyName: name || null },
  });
  if (updated.count === 0) throw new Error("Famille introuvable.");
  revalidateFamilyPages(parentId);
}
