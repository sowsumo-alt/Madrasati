"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { feeSchema, paymentSchema, type FeeFormValues, type PaymentFormValues } from "./schema";

export async function createFee(values: FeeFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = feeSchema.parse(values);

  const academicYear = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isCurrent: true },
  });
  if (!academicYear) throw new Error("Aucune année scolaire active.");

  await prisma.fee.create({
    data: {
      schoolId: user.schoolId,
      studentId: data.studentId,
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
    include: { payments: true },
  });
  if (!fee) throw new Error("Frais introuvable.");

  const year = new Date().getFullYear();
  const countThisYear = await prisma.payment.count({
    where: { schoolId: user.schoolId },
  });
  const receiptNumber = `REC-${year}-${String(countThisYear + 1).padStart(4, "0")}`;

  const payment = await prisma.payment.create({
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

  const totalPaid =
    fee.payments.reduce((sum, p) => sum + p.amount, 0) + data.amount;
  const nextStatus =
    totalPaid >= fee.amount ? "PAID" : totalPaid > 0 ? "PARTIAL" : "PENDING";

  await prisma.fee.update({
    where: { id: fee.id },
    data: { status: nextStatus },
  });

  revalidatePath("/directeur/finance");
  revalidatePath("/directeur");
  return { paymentId: payment.id };
}
