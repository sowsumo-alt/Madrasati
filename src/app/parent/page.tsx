import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { buildReportCards } from "@/lib/report-card-data";
import { ParentView, type ChildData } from "./parent-view";

const TERMS = ["Trimestre 1", "Trimestre 2", "Trimestre 3"];

export default async function ParentHome({
  searchParams,
}: {
  searchParams: Promise<{ childId?: string; term?: string }>;
}) {
  const user = await requireRole(ROLES.PARENT);
  const params = await searchParams;
  const term = params.term && TERMS.includes(params.term) ? params.term : TERMS[0];

  const parent = await prisma.parent.findFirst({
    where: { userId: user.id, schoolId: user.schoolId },
    include: {
      studentLinks: {
        include: {
          student: {
            include: { classRoom: { select: { id: true, name: true, level: true } } },
          },
        },
      },
    },
  });

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true, phone: true },
  });

  if (!parent || parent.studentLinks.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-5 py-16 text-center">
        <p className="text-sm text-foreground/60">
          Aucun enfant n&apos;est encore rattaché à votre compte. Contactez
          l&apos;école pour faire le lien.
        </p>
      </div>
    );
  }

  const children = parent.studentLinks.map((l) => l.student);
  const selected =
    children.find((c) => c.id === params.childId) ?? children[0];

  // — Présences de l'enfant sélectionné
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: { studentId: selected.id },
    orderBy: { date: "desc" },
    take: 30,
    select: { date: true, status: true },
  });
  const presentCount = attendanceRecords.filter(
    (a) => a.status === "PRESENT" || a.status === "LATE",
  ).length;
  const attendanceRate =
    attendanceRecords.length > 0
      ? Math.round((presentCount / attendanceRecords.length) * 100)
      : 100;

  // — Frais et paiements
  const fees = await prisma.fee.findMany({
    where: { studentId: selected.id },
    orderBy: { dueDate: "asc" },
    include: { payments: { select: { amount: true, paidAt: true, receiptNumber: true } } },
  });

  // — Bulletin : on réutilise le calcul du directeur, filtré sur cet enfant.
  let reportCard: ChildData["reportCard"] = null;
  if (selected.classRoom) {
    const cards = await buildReportCards(user.schoolId, selected.classRoom.id, term);
    const card = cards.find((c) => c.student.id === selected.id);
    if (card) {
      const comment = await prisma.reportCardComment.findUnique({
        where: { studentId_term: { studentId: selected.id, term } },
        select: { body: true, bodyAr: true },
      });
      reportCard = {
        lines: card.results.map((l) => ({
          subject: l.subjectName,
          coefficient: l.coefficient,
          average: l.average,
          classAverage: l.classAverage,
        })),
        overallAverage: card.average,
        mention: card.mention,
        rank: card.rank,
        classSize: card.classSize,
        comment: comment?.body ?? null,
        commentAr: comment?.bodyAr ?? null,
      };
    }
  }

  // — Emploi du temps de sa classe
  const slots = selected.classRoom
    ? await prisma.scheduleSlot.findMany({
        where: { classId: selected.classRoom.id },
        orderBy: { startMinutes: "asc" },
        include: {
          classSubject: {
            include: {
              subject: { select: { name: true } },
              teacher: { select: { firstName: true, lastName: true } },
            },
          },
        },
      })
    : [];

  const data: ChildData = {
    id: selected.id,
    firstName: selected.firstName,
    lastName: selected.lastName,
    className: selected.classRoom?.name ?? null,
    attendanceRate,
    attendanceHistory: attendanceRecords.map((a) => ({
      date: a.date.toISOString(),
      status: a.status,
    })),
    fees: fees.map((f) => ({
      id: f.id,
      label: f.label,
      amount: f.amount,
      dueDate: f.dueDate.toISOString(),
      status: f.status,
      totalPaid: f.payments.reduce((sum, p) => sum + p.amount, 0),
    })),
    reportCard,
    schedule: slots.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startMinutes: s.startMinutes,
      endMinutes: s.endMinutes,
      room: s.room,
      subject: s.classSubject.subject.name,
      teacher: s.classSubject.teacher
        ? `${s.classSubject.teacher.firstName} ${s.classSubject.teacher.lastName}`
        : null,
    })),
  };

  return (
    <ParentView
      parentName={`${parent.firstName} ${parent.lastName}`}
      childList={children.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
      }))}
      selectedChildId={selected.id}
      selectedTerm={term}
      terms={TERMS}
      data={data}
      schoolName={school?.name ?? "Madrasati"}
      schoolPhone={school?.phone ?? null}
    />
  );
}
