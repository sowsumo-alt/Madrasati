import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { FinanceView, type FeeRow } from "./finance-view";

const DEFAULT_REMINDER =
  "Bonjour {parentName}, nous vous rappelons que les frais de scolarité de {studentName} ({amount} MRU) sont en attente de paiement. École {schoolName}.";

export default async function FinancePage() {
  const user = await requireRole(ROLES.DIRECTOR);

  const [fees, students, school, template] = await Promise.all([
    prisma.fee.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { dueDate: "asc" },
      include: {
        student: {
          include: {
            classRoom: { select: { name: true } },
            parentLinks: { where: { isPrimary: true }, include: { parent: true } },
          },
        },
        payments: { select: { id: true, amount: true, receiptNumber: true } },
      },
    }),
    prisma.student.findMany({
      where: { schoolId: user.schoolId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { classRoom: { select: { name: true } } },
    }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }),
    prisma.messageTemplate.findFirst({
      where: { schoolId: user.schoolId, key: "PAYMENT_REMINDER" },
      select: { body: true },
    }),
  ]);

  const rows: FeeRow[] = fees.map((f) => ({
    id: f.id,
    label: f.label,
    amount: f.amount,
    dueDate: f.dueDate.toISOString(),
    status: f.status,
    totalPaid: f.payments.reduce((sum, p) => sum + p.amount, 0),
    student: {
      id: f.student.id,
      firstName: f.student.firstName,
      lastName: f.student.lastName,
      className: f.student.classRoom?.name ?? null,
    },
    parent: f.student.parentLinks[0]
      ? {
          firstName: f.student.parentLinks[0].parent.firstName,
          lastName: f.student.parentLinks[0].parent.lastName,
          phone: f.student.parentLinks[0].parent.phone,
        }
      : null,
    payments: f.payments.map((p) => ({ id: p.id, receiptNumber: p.receiptNumber })),
  }));

  const studentOptions = students.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    className: s.classRoom?.name ?? null,
  }));

  return (
    <FinanceView
      fees={rows}
      students={studentOptions}
      schoolName={school?.name ?? "Madrasati"}
      reminderTemplate={template?.body ?? DEFAULT_REMINDER}
    />
  );
}
