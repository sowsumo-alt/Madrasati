"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { generateReceiptNumber, runWithReceipt } from "@/lib/receipts";
import { splitFullName } from "@/lib/student-form";
import { studentSchema, type StudentFormValues } from "./schema";
import { CURRENT_YEAR } from "@/lib/school-year";
import { assertNnisAvailable, nniConflict } from "@/lib/nni-data";
import { storedNni } from "@/lib/nni";
import { applyTuitionPlan, enrollmentPlan, enrollmentTuitionSchema, type EnrollmentTuition } from "@/lib/tuition-plan";

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
export async function createStudent(values: StudentFormValues, tuition?: EnrollmentTuition) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = studentSchema.parse(values);
  const plan = enrollmentPlan(enrollmentTuitionSchema.parse(tuition));
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
  const result = await runWithReceipt(async (tx, attempt) => {
    const student = await tx.student.create({
      data: {
        schoolId: user.schoolId,
        ...studentFields(data),
        // Le jour même si le champ a été vidé : l'inscription se fait sur place.
        enrollmentDate: data.enrollmentDate ? new Date(data.enrollmentDate) : new Date(),
      },
    });

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
    }

    let paymentId: string | undefined;

    // Frais d'inscription payé sur place, optionnel : réutilise le même
    // circuit Frais/Paiement/Reçu que le module Finance, réglé en une fois.
    if (data.enrollmentAmount && data.enrollmentAmount > 0) {
      const year = await tx.academicYear.findFirst({
        where: { schoolId: user.schoolId, isCurrent: true },
      });
      if (!year) throw new Error("Aucune année scolaire active.");

      const fee = await tx.fee.create({
        data: {
          schoolId: user.schoolId,
          studentId: student.id,
          academicYearId: year.id,
          label: `Frais d'inscription — ${year.label}`,
          amount: data.enrollmentAmount,
          dueDate: new Date(),
          status: "PAID",
        },
      });

      const receiptNumber = await generateReceiptNumber(tx, user.schoolId, attempt);
      const payment = await tx.payment.create({
        data: {
          schoolId: user.schoolId,
          feeId: fee.id,
          studentId: student.id,
          amount: data.enrollmentAmount,
          method: data.enrollmentMethod ?? "CASH",
          receiptNumber,
          recordedByUserId: user.id,
        },
      });
      paymentId = payment.id;
    }

    // Les échéances des frais de scolarité, à partir du mois d'inscription.
    if (plan) {
      const year = await tx.academicYear.findFirst({
        where: { schoolId: user.schoolId, isCurrent: true },
        select: { id: true, label: true, startDate: true, endDate: true },
      });
      if (!year) throw new Error("Aucune année scolaire active.");
      await applyTuitionPlan(tx, {
        schoolId: user.schoolId,
        studentId: student.id,
        year,
        ...plan,
        firstMonth: student.enrollmentDate,
      });
    }

    return { id: student.id, paymentId };
  });

  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
  if (result.paymentId || plan) revalidatePath("/directeur/finance");
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
