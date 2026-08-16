import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { FinanceView, type FeeRow } from "./finance-view";

const DEFAULT_REMINDER =
  "Bonjour {parentName},\n\nNous vous rappelons que des frais de scolarité de {amount} MRU concernant {studentName} sont en attente de paiement, avec échéance au {date}. Merci de bien vouloir régulariser votre situation.\n\n{schoolName}";
const DEFAULT_REMINDER_AR =
  "مرحبًا {parentName}،\n\nنذكركم بأن مبلغ {amount} أوقية موريتانية الخاص بالرسوم الدراسية لـ {studentName} لا يزال معلقًا، وتاريخ الاستحقاق هو {date}. يرجى التكرم بتسوية وضعيتكم.\n\n{schoolName}";

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
        payments: {
          select: { id: true, amount: true, receiptNumber: true },
          orderBy: { paidAt: "asc" },
        },
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
      select: { body: true, bodyAr: true },
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
      reminderTemplateAr={template?.bodyAr ?? DEFAULT_REMINDER_AR}
    />
  );
}
