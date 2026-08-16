"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireFeature } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { FEATURES } from "@/lib/plans";
import {
  contractSchema,
  type ContractFormValues,
  leaveSchema,
  type LeaveFormValues,
  generatePayslipSchema,
  type GeneratePayslipValues,
} from "./schema";

async function assertOwnTeacher(schoolId: string, teacherId: string) {
  const teacher = await prisma.teacher.findFirst({ where: { id: teacherId, schoolId } });
  if (!teacher) throw new Error("Enseignant introuvable.");
  return teacher;
}

export async function upsertContract(values: ContractFormValues) {
  const user = await requireFeature(FEATURES.HR_PAYROLL, ROLES.DIRECTOR);
  const data = contractSchema.parse(values);
  const teacher = await assertOwnTeacher(user.schoolId, data.teacherId);

  await prisma.$transaction(async (tx) => {
    const contract = await tx.teacherContract.upsert({
      where: { teacherId: teacher.id },
      create: {
        schoolId: user.schoolId,
        teacherId: teacher.id,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        leaveDaysPerYear: data.leaveDaysPerYear,
      },
      update: {
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        leaveDaysPerYear: data.leaveDaysPerYear,
      },
    });

    await tx.teacherBonus.deleteMany({ where: { contractId: contract.id } });
    if (data.bonuses.length > 0) {
      await tx.teacherBonus.createMany({
        data: data.bonuses.map((b) => ({
          contractId: contract.id,
          label: b.label,
          amount: b.amount,
        })),
      });
    }
  });

  revalidatePath("/directeur/rh");
}

export async function recordLeave(values: LeaveFormValues) {
  const user = await requireFeature(FEATURES.HR_PAYROLL, ROLES.DIRECTOR);
  const data = leaveSchema.parse(values);
  const teacher = await assertOwnTeacher(user.schoolId, data.teacherId);

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (end < start) throw new Error("La date de fin doit être après la date de début.");

  await prisma.teacherLeave.create({
    data: {
      schoolId: user.schoolId,
      teacherId: teacher.id,
      startDate: start,
      endDate: end,
      reason: data.reason,
      note: data.note || null,
    },
  });

  revalidatePath("/directeur/rh");
}

export async function deleteLeave(leaveId: string) {
  const user = await requireFeature(FEATURES.HR_PAYROLL, ROLES.DIRECTOR);
  await prisma.teacherLeave.deleteMany({ where: { id: leaveId, schoolId: user.schoolId } });
  revalidatePath("/directeur/rh");
}

/** Génère (ou régénère) le bulletin du mois : les lignes de prime sont
 *  toujours reconstruites depuis le contrat actuel, pour rester exactes même
 *  si les primes ont changé depuis la dernière génération. */
export async function generatePayslip(values: GeneratePayslipValues): Promise<string> {
  const user = await requireFeature(FEATURES.HR_PAYROLL, ROLES.DIRECTOR);
  const data = generatePayslipSchema.parse(values);
  const teacher = await assertOwnTeacher(user.schoolId, data.teacherId);

  const contract = await prisma.teacherContract.findUnique({
    where: { teacherId: teacher.id },
    include: { bonuses: true },
  });
  const bonuses = contract?.bonuses ?? [];
  const baseSalary = teacher.monthlySalary ?? 0;
  const bonusTotal = bonuses.reduce((sum, b) => sum + b.amount, 0);
  const netPay = baseSalary + bonusTotal - data.deductions;

  const payslipId = await prisma.$transaction(async (tx) => {
    const payslip = await tx.payslip.upsert({
      where: {
        teacherId_month_year: { teacherId: teacher.id, month: data.month, year: data.year },
      },
      create: {
        schoolId: user.schoolId,
        teacherId: teacher.id,
        month: data.month,
        year: data.year,
        baseSalary,
        deductions: data.deductions,
        deductionNote: data.deductionNote || null,
        netPay,
        generatedByUserId: user.id,
      },
      update: {
        baseSalary,
        deductions: data.deductions,
        deductionNote: data.deductionNote || null,
        netPay,
        generatedAt: new Date(),
        generatedByUserId: user.id,
      },
    });

    await tx.payslipBonusLine.deleteMany({ where: { payslipId: payslip.id } });
    if (bonuses.length > 0) {
      await tx.payslipBonusLine.createMany({
        data: bonuses.map((b) => ({ payslipId: payslip.id, label: b.label, amount: b.amount })),
      });
    }

    return payslip.id;
  });

  revalidatePath("/directeur/rh");
  return payslipId;
}
