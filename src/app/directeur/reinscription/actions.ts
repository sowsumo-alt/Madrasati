"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { generateReceiptNumber, runWithReceipt } from "@/lib/receipts";

async function getCurrentAcademicYear(schoolId: string) {
  const year = await prisma.academicYear.findFirst({
    where: { schoolId, isCurrent: true },
  });
  if (!year) throw new Error("Aucune année scolaire active.");
  return year;
}

async function getTargetClass(schoolId: string, targetClassId: string) {
  const year = await getCurrentAcademicYear(schoolId);
  const targetClass = await prisma.classRoom.findFirst({
    where: { id: targetClassId, schoolId, academicYearId: year.id },
  });
  if (!targetClass) throw new Error("Classe de destination invalide.");
  return targetClass;
}

export async function reenrollStudent(
  studentId: string,
  targetClassId: string,
  amount?: number,
  method?: string,
) {
  const user = await requireRole(ROLES.DIRECTOR);
  const targetClass = await getTargetClass(user.schoolId, targetClassId);

  // Même circuit que Finance et l inscription : si le numéro de reçu vient
  // d être pris, la transaction est rejouée au lieu d échouer.
  const paymentId = await runWithReceipt(async (tx, attempt) => {
    const updated = await tx.student.updateMany({
      where: { id: studentId, schoolId: user.schoolId },
      data: { classId: targetClass.id, status: "ACTIVE" },
    });
    // Aucune ligne modifiée : le studentId ne fait pas partie de cette école.
    // Sans ce contrôle, un Fee/Payment serait quand même créé plus bas pour
    // un élève d'une autre école (fuite de nom/classe/parent côté Finance).
    if (updated.count === 0) throw new Error("Élève introuvable.");

    if (!amount || amount <= 0) return undefined;

    const year = await tx.academicYear.findFirst({
      where: { schoolId: user.schoolId, isCurrent: true },
    });
    if (!year) throw new Error("Aucune année scolaire active.");

    const fee = await tx.fee.create({
      data: {
        schoolId: user.schoolId,
        studentId,
        academicYearId: year.id,
        label: `Frais de réinscription — ${year.label}`,
        amount,
        dueDate: new Date(),
        status: "PAID",
      },
    });

    const receiptNumber = await generateReceiptNumber(tx, user.schoolId, attempt);
    const payment = await tx.payment.create({
      data: {
        schoolId: user.schoolId,
        feeId: fee.id,
        studentId,
        amount,
        method: method || "CASH",
        receiptNumber,
        recordedByUserId: user.id,
      },
    });
    return payment.id;
  });

  revalidatePath("/directeur/reinscription");
  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
  if (paymentId) revalidatePath("/directeur/finance");
  return { paymentId };
}

export async function reenrollClass(sourceClassId: string, targetClassId: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  const targetClass = await getTargetClass(user.schoolId, targetClassId);

  await prisma.student.updateMany({
    where: { schoolId: user.schoolId, classId: sourceClassId, status: "ACTIVE" },
    data: { classId: targetClass.id },
  });

  revalidatePath("/directeur/reinscription");
  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
}

export async function markNotReenrolled(studentId: string) {
  const user = await requireRole(ROLES.DIRECTOR);

  await prisma.student.updateMany({
    where: { id: studentId, schoolId: user.schoolId },
    data: { status: "INACTIVE" },
  });

  revalidatePath("/directeur/reinscription");
  revalidatePath("/directeur/eleves");
  revalidatePath("/directeur");
}
