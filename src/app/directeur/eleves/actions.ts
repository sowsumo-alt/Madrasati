"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { runWithReceipt } from "@/lib/receipts";
import { reattachFamilySheets, recordFamilySheet, recordSheetPayments } from "@/lib/family-sheet-data";
import { familySheetSchema, type FamilySheetInput } from "@/lib/family-sheet";
import { UserError, asResult } from "@/lib/user-error";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { splitFullName } from "@/lib/student-form";
import { studentSchema, type StudentFormValues } from "./schema";
import { CURRENT_YEAR } from "@/lib/school-year";
import { assertNnisAvailable, nniConflict } from "@/lib/nni-data";
import { storedNni } from "@/lib/nni";
import { ACTIVITY_ACTIONS, logActivity } from "@/lib/activity";

/** Compare deux noms en ignorant casse, accents composés et espaces multiples. */
function normalizeName(value: string) {
  return value.trim().toLowerCase().normalize("NFC").replace(/\s+/g, " ");
}

export interface DuplicateStudent {
  id: string;
  name: string;
  className: string | null;
}

/**
 * Élèves déjà inscrits portant le même nom, à la casse près. Deux homonymes
 * existent réellement dans une école, donc on avertit sans bloquer — mais
 * « Ahmadou Sow » et « ahmadou sow » créés côte à côte sont une faute de
 * saisie que personne ne remarque avant que les notes ne se dispersent entre
 * deux fiches.
 */
export async function findDuplicateStudents(
  firstName: string,
  lastName: string,
): Promise<DuplicateStudent[]> {
  const user = await requireRole(ROLES.DIRECTOR);
  const target = normalizeName(`${firstName} ${lastName}`);
  if (!target.trim()) return [];

  const candidates = await prisma.student.findMany({
    where: {
      schoolId: user.schoolId,
      firstName: { equals: firstName.trim(), mode: "insensitive" },
      lastName: { equals: lastName.trim(), mode: "insensitive" },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      classRoom: { select: { name: true } },
    },
  });

  return candidates
    .filter((c) => normalizeName(`${c.firstName} ${c.lastName}`) === target)
    .map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      className: c.classRoom?.name ?? null,
    }));
}

/** Champs du dossier élève communs à la création et à la modification. */
function studentFields(data: StudentFormValues) {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
    gender: data.gender,
    placeOfBirth: data.placeOfBirth || null,
    nationality: data.nationality || null,
    nni: storedNni(data.nni),
    rimNumber: data.rimNumber || null,
    motherName: data.motherName || null,
    classId: data.classId || null,
    status: data.status,
    photoUrl: data.photoUrl || null,
  };
}

/**
 * `tuition` : la formule de paiement des frais de scolarité choisie à
 * l'inscription ; ses échéances sont créées avec l'élève.
 */
/**
 * Inscription d'un élève seul, avec sa fiche de paiement (facultative) —
 * la même fiche et le même calcul que pour une famille (lib/family-sheet.ts).
 * Les erreurs de saisie reviennent en clair (UserError).
 */
export async function createStudent(values: StudentFormValues, sheetInput?: FamilySheetInput, method?: string, submissionKey?: string) {
  return asResult(() => createStudentWithSheet(values, sheetInput, method, submissionKey));
}

async function createStudentWithSheet(values: StudentFormValues, sheetInput?: FamilySheetInput, method?: string, submissionKey?: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = studentSchema.parse(values);
  const sheet = sheetInput ? familySheetSchema.parse(sheetInput) : undefined;
  if (method && !(PAYMENT_METHODS as readonly string[]).includes(method)) throw new UserError("Mode de paiement inconnu.");
  await assertNnisAvailable(user.schoolId, [data.nni]);

  // classId non vérifié : un ID d'une autre école ferait apparaître son nom
  // de classe (et fausserait ses effectifs) dans les listings de ce
  // directeur, sans qu'il ait le droit d'y rattacher qui que ce soit.
  if (data.classId) {
    const cls = await prisma.classRoom.findFirst({
      where: { id: data.classId, schoolId: user.schoolId },
    });
    if (!cls) throw new Error("Classe introuvable.");
  }

  // Passe par runWithReceipt même si les frais d'inscription sont optionnels :
  // c'est ce circuit qui rejoue la transaction si le numéro de reçu vient
  // d'être pris. Sans lui, une collision annulait l'inscription entière —
  // l'élève, son parent et le paiement — et le directeur ne voyait qu'un
  // « Une erreur est survenue » sans savoir ce qui avait été enregistré.
  const result = await runWithReceipt(user.schoolId, async (tx, attempt) => {
    const student = await tx.student.create({
      data: {
        schoolId: user.schoolId,
        ...studentFields(data),
        // Le jour même si le champ a été vidé : l'inscription se fait sur place.
        enrollmentDate: data.enrollmentDate ? new Date(data.enrollmentDate) : new Date(),
      },
    });

    let primaryParentId: string | null = null;
    if (data.parentName && data.parentPhone) {
      const parentName = splitFullName(data.parentName);
      // Même nom et même téléphone : c'est le même tuteur, pas un homonyme.
      // Le recréer dupliquait la fiche à chaque frère ou sœur inscrit — c'est
      // ainsi que « Abou Sow » et « abou sow » ont coexisté.
      const existing = await tx.parent.findFirst({
        where: {
          schoolId: user.schoolId,
          phone: data.parentPhone,
          firstName: { equals: parentName.firstName, mode: "insensitive" },
          lastName: { equals: parentName.lastName, mode: "insensitive" },
        },
        select: { id: true, address: true },
      });

      let parentId = existing?.id;
      if (!parentId) {
        parentId = (
          await tx.parent.create({
            data: {
              schoolId: user.schoolId,
              firstName: parentName.firstName,
              lastName: parentName.lastName,
              phone: data.parentPhone,
              address: data.parentAddress || null,
              relationship: "tuteur",
            },
          })
        ).id;
      } else if (!existing?.address && data.parentAddress) {
        // Fiche déjà connue (un frère ou une sœur) : l'adresse la complète,
        // sans jamais écraser une adresse déjà saisie.
        await tx.parent.update({
          where: { id: parentId },
          data: { address: data.parentAddress },
        });
      }

      await tx.studentParent.create({
        data: { studentId: student.id, parentId, isPrimary: true },
      });
      primaryParentId = parentId;
    }

    const year = sheet
      ? await tx.academicYear.findFirst({
          where: { schoolId: user.schoolId, isCurrent: true },
          select: { id: true, label: true, startDate: true, endDate: true },
        })
      : null;
    if (sheet && !year) throw new UserError("Aucune année scolaire active.");

    // La fiche de paiement de l'élève : la même que celle d'une famille, à
    // un seul élève — inscription, mois, ce qui est versé et à quelle date.
    let receipts: { firstPaymentId: string | null }[] = [];
    if (sheet && year) {
      const now = new Date();
      const parts = await recordFamilySheet(tx, {
        schoolId: user.schoolId,
        year,
        familyParentId: null,
        referentStudentId: student.id,
        sheet,
        firstMonth: student.enrollmentDate,
        now,
      });
      receipts = await recordSheetPayments(tx, {
        schoolId: user.schoolId,
        parts,
        method: method ?? "CASH",
        userId: user.id,
        attempt,
        now,
        parentId: primaryParentId,
      });
    }
    await logActivity(tx, {
      schoolId: user.schoolId,
      userId: user.id,
      action: ACTIVITY_ACTIONS.ENROLL,
      summary: `Inscription — ${student.firstName} ${student.lastName}`.trim(),
      href: "/directeur/eleves",
    });
    const last = receipts[receipts.length - 1];
    return { id: student.id, paymentId: last?.firstPaymentId ?? undefined, receiptCount: receipts.length };
  }, { submissionKey: submissionKey });

  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
  if (sheet) revalidatePath("/directeur/finance");
  return result;
}

export async function updateStudent(studentId: string, values: StudentFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = studentSchema.parse(values);

  const existing = await prisma.student.findFirst({
    where: { id: studentId, schoolId: user.schoolId },
    include: { parentLinks: { include: { parent: true } } },
  });
  if (!existing) throw new Error("Élève introuvable.");
  await assertNnisAvailable(user.schoolId, [data.nni], studentId);

  if (data.classId) {
    const cls = await prisma.classRoom.findFirst({
      where: { id: data.classId, schoolId: user.schoolId },
    });
    if (!cls) throw new Error("Classe introuvable.");
  }

  await prisma.student.update({
    where: { id: studentId },
    data: {
      ...studentFields(data),
      ...(data.enrollmentDate ? { enrollmentDate: new Date(data.enrollmentDate) } : {}),
    },
  });
  // Élève référent d'une fiche familiale qui n'est plus actif : la fiche
  // passe à un autre enfant de la famille.
  await reattachFamilySheets(prisma, [studentId]);

  if (data.parentName && data.parentPhone) {
    const parentName = splitFullName(data.parentName);
    const parentData = {
      firstName: parentName.firstName,
      lastName: parentName.lastName,
      phone: data.parentPhone,
      address: data.parentAddress || null,
    };
    const primaryLink = existing.parentLinks.find((l) => l.isPrimary);
    if (primaryLink) {
      await prisma.parent.update({ where: { id: primaryLink.parentId }, data: parentData });
    } else {
      const parent = await prisma.parent.create({
        data: { schoolId: user.schoolId, ...parentData, relationship: "tuteur" },
      });
      await prisma.studentParent.create({
        data: { studentId, parentId: parent.id, isPrimary: true },
      });
    }
  }

  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
}

export async function setStudentStatus(studentId: string, status: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  await prisma.student.updateMany({
    where: { id: studentId, schoolId: user.schoolId },
    data: { status },
  });
  await reattachFamilySheets(prisma, [studentId]);
  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
}

const bulkIdsSchema = z.array(z.string().min(1)).min(1).max(1000);

/**
 * Change plusieurs élèves de classe en une fois (cases cochées de la liste).
 * Renvoie le nombre d'élèves réellement déplacés : les identifiants d'une
 * autre école sont ignorés par le filtre sur schoolId.
 */
export async function moveStudentsToClass(studentIds: string[], classId: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  const ids = bulkIdsSchema.parse(studentIds);

  // Même garde que pour un élève seul, et limitée à l'année en cours : les
  // classes proposées dans la liste sont celles-là.
  const cls = await prisma.classRoom.findFirst({
    where: { id: classId, schoolId: user.schoolId, ...CURRENT_YEAR },
    select: { id: true },
  });
  if (!cls) throw new Error("Classe introuvable.");

  const { count } = await prisma.student.updateMany({
    where: { id: { in: ids }, schoolId: user.schoolId },
    data: { classId: cls.id },
  });

  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
  return count;
}

/** Retire (ou réactive) plusieurs élèves en une fois — le même statut que « Retirer » élève par élève. */
export async function setStudentsStatus(studentIds: string[], status: "ACTIVE" | "INACTIVE") {
  const user = await requireRole(ROLES.DIRECTOR);
  const ids = bulkIdsSchema.parse(studentIds);
  const next = z.enum(["ACTIVE", "INACTIVE"]).parse(status);

  const { count } = await prisma.student.updateMany({
    where: { id: { in: ids }, schoolId: user.schoolId },
    data: { status: next },
  });
  await reattachFamilySheets(prisma, ids);

  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
  return count;
}

/**
 * Le NNI saisi appartient-il déjà à un autre élève de l'école ? Appelé par
 * les formulaires avant d'enregistrer, pour afficher le message sous le
 * champ plutôt qu'une erreur générique.
 */
export async function checkStudentNnis(nnis: string[], exceptStudentId?: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  return nniConflict(user.schoolId, nnis, exceptStudentId);
}
