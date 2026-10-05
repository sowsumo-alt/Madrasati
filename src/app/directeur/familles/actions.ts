"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserError, asResult, type ActionResult } from "@/lib/user-error";
import { assertNnisAvailable } from "@/lib/nni-data";
import { storedNni } from "@/lib/nni";
import { recordFamilySheet, recordSheetPayments, type DatedPart } from "@/lib/family-sheet-data";
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

/**
 * L'inscription d'une famille pour le formulaire : le résultat, ou une raison
 * lisible. En production, Next.js masque le message des erreurs levées par
 * une action — le directeur voyait « ça ne passe pas », sans savoir pourquoi.
 * Une erreur prévue (UserError) garde son message ; une coupure vers la base
 * ou un délai dépassé le dit, en rappelant que rien n'a été enregistré : tout
 * se fait dans une seule transaction.
 */
export async function enrollFamilyChecked(values: FamilyEnrollmentValues): Promise<ActionResult<FamilyEnrollmentResult>> {
  try {
    return await asResult(() => enrollFamily(values));
  } catch (e) {
    console.error("Inscription de famille échouée", e);
    return {
      ok: false,
      error:
        "L'enregistrement n'a pas abouti (connexion à la base de données). Rien n'a été enregistré : vérifiez la connexion et réessayez.",
    };
  }
}

export interface FamilyEnrollmentResult {
  parentId: string;
  studentIds: string[];
  /** Reçu unique de la famille, en paiement groupé. */
  familyPaymentId: string | null;
  /** Reçus individuels, en paiements séparés. */
  paymentIds: string[];
  /** Nombre de reçus d'une fiche : un par date de versement. */
  receiptCount?: number;
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
  if (classCount !== classIds.length) throw new UserError("Classe introuvable.");

  const parentName = splitFullName(data.parentName);
  // Les fiches de paiement portent seules les montants (lib/family-sheet.ts) :
  // aucun montant n'est calculé par enfant. Sans fiche, rien n'est facturé.
  const sheets = data.sheets && data.sheets.length > 0 ? data.sheets : null;
  if (sheets?.some((s) => s.referentIndex >= data.children.length)) throw new UserError("Élève référent introuvable.");

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
    if (data.existingParentId && !parent) throw new UserError("Famille introuvable.");

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

    const year = sheets
      ? await tx.academicYear.findFirst({ where: { schoolId: user.schoolId, isCurrent: true } })
      : null;
    if (sheets && !year) throw new UserError("Aucune année scolaire active.");

    // — Les enfants : des élèves ordinaires, rattachés à la famille.
    const now = new Date();
    const children: { studentId: string }[] = [];
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
          rimNumber: child.rimNumber || null,
          classId: child.classId,
          nationality: DEFAULT_NATIONALITY,
          status: "ACTIVE",
          enrollmentDate: now,
        },
      });
      await tx.studentParent.create({
        data: { studentId: student.id, parentId: parent.id, isPrimary: true },
      });

      children.push({ studentId: student.id });
    }

    // — Le règlement : un reçu par date de versement.
    let familyPaymentId: string | null = null;
    let receiptCount = 0;
    const paymentIds: string[] = [];
    const common = { schoolId: user.schoolId, method: data.method, userId: user.id, attempt, parentId: parent.id };

    if (sheets && year) {
      // Une fiche pour la famille : ses montants vont à l'élève référent et
      // appartiennent à la famille. Une fiche par enfant : chacune à son
      // enfant. Un seul enfant : sa fiche, comme un élève inscrit seul. Un
      // reçu par date de versement (aujourd'hui, ou les dates recopiées).
      const familySheet = sheets.length === 1 && children.length > 1;
      const all: DatedPart[] = [];
      for (const sheet of sheets) {
        all.push(
          ...(await recordFamilySheet(tx, {
            schoolId: user.schoolId,
            year,
            familyParentId: familySheet ? parent.id : null,
            referentStudentId: children[sheet.referentIndex].studentId,
            sheet,
            firstMonth: now,
            now,
          })),
        );
      }
      const receipts = await recordSheetPayments(tx, {
        ...common,
        now,
        parts: all,
        forceGroup: children.length > 1,
      });
      receiptCount = receipts.length;
      // Le reçu du jour (le dernier), ou celui de la dernière date recopiée.
      const last = receipts[receipts.length - 1];
      if (last) {
        familyPaymentId = last.groupId;
        if (last.firstPaymentId) paymentIds.push(last.firstPaymentId);
      }
    }

    return {
      parentId: parent.id,
      studentIds: children.map((c) => c.studentId),
      familyPaymentId,
      paymentIds,
      receiptCount,
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
