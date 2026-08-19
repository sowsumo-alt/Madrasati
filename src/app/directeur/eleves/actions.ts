"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { generateReceiptNumber, runWithReceipt } from "@/lib/receipts";
import { studentSchema, type StudentFormValues } from "./schema";
import { CURRENT_YEAR } from "@/lib/school-year";

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

export async function createStudent(values: StudentFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = studentSchema.parse(values);

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
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        gender: data.gender || null,
        classId: data.classId || null,
        status: data.status,
        photoUrl: data.photoUrl || null,
      },
    });

    if (data.parentFirstName && data.parentLastName && data.parentPhone) {
      // Même nom et même téléphone : c'est le même tuteur, pas un homonyme.
      // Le recréer dupliquait la fiche à chaque frère ou sœur inscrit — c'est
      // ainsi que « Abou Sow » et « abou sow » ont coexisté.
      const existing = await tx.parent.findFirst({
        where: {
          schoolId: user.schoolId,
          phone: data.parentPhone,
          firstName: { equals: data.parentFirstName, mode: "insensitive" },
          lastName: { equals: data.parentLastName, mode: "insensitive" },
        },
        select: { id: true },
      });

      const parentId =
        existing?.id ??
        (
          await tx.parent.create({
            data: {
              schoolId: user.schoolId,
              firstName: data.parentFirstName,
              lastName: data.parentLastName,
              phone: data.parentPhone,
              relationship: "tuteur",
            },
          })
        ).id;

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

    return { id: student.id, paymentId };
  });

  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
  if (result.paymentId) revalidatePath("/directeur/finance");
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

  if (data.classId) {
    const cls = await prisma.classRoom.findFirst({
      where: { id: data.classId, schoolId: user.schoolId },
    });
    if (!cls) throw new Error("Classe introuvable.");
  }

  await prisma.student.update({
    where: { id: studentId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: data.gender || null,
      classId: data.classId || null,
      status: data.status,
      photoUrl: data.photoUrl || null,
    },
  });

  if (data.parentFirstName && data.parentLastName && data.parentPhone) {
    const primaryLink = existing.parentLinks.find((l) => l.isPrimary);
    if (primaryLink) {
      await prisma.parent.update({
        where: { id: primaryLink.parentId },
        data: {
          firstName: data.parentFirstName,
          lastName: data.parentLastName,
          phone: data.parentPhone,
        },
      });
    } else {
      const parent = await prisma.parent.create({
        data: {
          schoolId: user.schoolId,
          firstName: data.parentFirstName,
          lastName: data.parentLastName,
          phone: data.parentPhone,
          relationship: "tuteur",
        },
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

interface ImportRow {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  className?: string;
}

/** Normalise pour comparer deux noms de classe malgré espaces, accents
 *  différemment encodés ("è" composé vs décomposé) ou casse différente. */
function normalizeClassName(name: string) {
  return name.trim().toLowerCase().normalize("NFC");
}

/**
 * Lit une date de naissance depuis une cellule Excel, qui peut arriver sous
 * plusieurs formes selon comment la feuille a été remplie :
 * - une date Excel réelle, déjà convertie en texte lisible par le client
 *   (voir cellDates dans import-dialog.tsx) ;
 * - du texte saisi à la main au format français JJ/MM/AAAA ;
 * - un numéro de série Excel resté brut (cellule non formatée en date).
 */
function parseFlexibleDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const frMatch = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (frMatch) {
    const [, day, month, year] = frMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (!Number.isNaN(date.getTime())) return date;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    // Plage plausible pour une date de naissance stockée en numéro de série
    // Excel (jours depuis le 30/12/1899) — évite de mal interpréter un
    // simple entier qui ne serait pas du tout une date.
    if (serial > 1000 && serial < 100000) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const date = new Date(excelEpoch + serial * 86_400_000);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function importStudents(rows: ImportRow[]) {
  const user = await requireRole(ROLES.DIRECTOR);

  const classes = await prisma.classRoom.findMany({
    where: { schoolId: user.schoolId, ...CURRENT_YEAR },
    select: { id: true, name: true },
  });
  const classByName = new Map(
    classes.map((c) => [normalizeClassName(c.name), c.id]),
  );

  const toCreate: {
    schoolId: string;
    firstName: string;
    lastName: string;
    gender: string | null;
    dateOfBirth: Date | null;
    classId: string | null;
    status: string;
  }[] = [];
  const skipped: { row: number; reason: string }[] = [];
  const unmatchedClassNames = new Set<string>();
  let missingDateCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const firstName = row.firstName?.trim();
    const lastName = row.lastName?.trim();

    if (!firstName || !lastName) {
      skipped.push({ row: i + 2, reason: "Prénom ou nom manquant" });
      continue;
    }

    const genderRaw = row.gender?.trim().toUpperCase();
    const gender =
      genderRaw === "M" || genderRaw === "MASCULIN"
        ? "M"
        : genderRaw === "F" || genderRaw === "FEMININ" || genderRaw === "FÉMININ"
          ? "F"
          : null;

    const dateOfBirth = row.dateOfBirth ? parseFlexibleDate(row.dateOfBirth) : null;
    if (row.dateOfBirth && !dateOfBirth) missingDateCount++;

    let classId: string | null = null;
    if (row.className) {
      classId = classByName.get(normalizeClassName(row.className)) ?? null;
      if (!classId) unmatchedClassNames.add(row.className.trim());
    }

    toCreate.push({
      schoolId: user.schoolId,
      firstName,
      lastName,
      gender,
      dateOfBirth,
      classId,
      status: "ACTIVE",
    });
  }

  // Une seule écriture groupée, et non un `create` par ligne : un fichier de
  // 200 élèves déclenchait 200 allers-retours vers la base, et une coupure au
  // milieu laissait la moitié de la classe importée sans que le directeur
  // sache lesquels — il ne pouvait ni reprendre ni recommencer proprement.
  // Ici, soit tout le fichier entre, soit rien.
  const created = toCreate.length
    ? (await prisma.student.createMany({ data: toCreate })).count
    : 0;

  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
  return {
    created,
    skipped,
    unmatchedClassNames: [...unmatchedClassNames],
    missingDateCount,
  };
}
