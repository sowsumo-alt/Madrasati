"use server";

import { basePrisma, prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { ACTIVITY_ACTIONS, logActivity } from "@/lib/activity";
import { UserError, asResult } from "@/lib/user-error";
import { familyLabel } from "@/lib/family";

type Row = Record<string, string | number | null>;
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

/**
 * Toutes les données d'une famille, pour répondre à une demande d'accès des
 * parents : identité, frais et reçus, présences, notes, discipline,
 * appréciations et décisions de fin d'année, rappels envoyés. Une feuille par
 * sujet. L'export est inscrit au journal (qui, quand).
 */
export async function familyDataExport(parentId: string) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    const parent = await prisma.parent.findFirst({
      where: { id: parentId, schoolId: user.schoolId },
      include: { studentLinks: { include: { student: { include: { classRoom: { select: { name: true } } } } } } },
    });
    if (!parent) throw new UserError("Famille introuvable.");
    const students = parent.studentLinks.map((l) => l.student);
    const ids = students.map((s) => s.id);
    const name = (id: string) => {
      const s = students.find((x) => x.id === id);
      return s ? `${s.firstName} ${s.lastName}`.trim() : "";
    };

    const [fees, cancelled, attendance, grades, incidents, comments, decisions, reminders] = await Promise.all([
      prisma.fee.findMany({ where: { schoolId: user.schoolId, studentId: { in: ids } }, include: { payments: true }, orderBy: { dueDate: "asc" } }),
      prisma.cancelledPayment.findMany({ where: { schoolId: user.schoolId, studentId: { in: ids } }, orderBy: { cancelledAt: "asc" } }),
      prisma.attendanceRecord.findMany({ where: { schoolId: user.schoolId, studentId: { in: ids } }, orderBy: { date: "asc" } }),
      prisma.grade.findMany({
        where: { studentId: { in: ids }, exam: { schoolId: user.schoolId } },
        include: { exam: { select: { title: true, term: true, date: true, maxScore: true, subject: { select: { name: true } } } } },
      }),
      prisma.disciplineIncident.findMany({ where: { schoolId: user.schoolId, studentId: { in: ids } }, orderBy: { date: "asc" } }),
      prisma.reportCardComment.findMany({ where: { schoolId: user.schoolId, studentId: { in: ids } } }),
      prisma.annualDecision.findMany({ where: { schoolId: user.schoolId, studentId: { in: ids } } }),
      prisma.paymentReminder.findMany({ where: { schoolId: user.schoolId, groupKey: parent.id }, orderBy: { sentAt: "asc" } }),
    ]);

    const sheets: Record<string, Row[]> = {
      Famille: [
        {
          Famille: familyLabel(parent, "Famille {name}"),
          Parent: `${parent.firstName} ${parent.lastName}`.trim(),
          Téléphone: parent.phone,
          "E-mail": parent.email,
          Adresse: parent.address,
          Lien: parent.relationship,
        },
      ],
      Enfants: students.map((s) => ({
        Élève: `${s.firstName} ${s.lastName}`.trim(),
        Classe: s.classRoom?.name ?? "",
        Statut: s.status,
        Genre: s.gender,
        Naissance: day(s.dateOfBirth),
        Lieu: s.placeOfBirth,
        Nationalité: s.nationality,
        Mère: s.motherName,
        NNI: s.nni,
        "N° RIM": s.rimNumber,
        Inscription: day(s.enrollmentDate),
        Photo: s.photoUrl ? "oui (dans l'application)" : "non",
      })),
      "Frais et paiements": fees.flatMap((f) => [
        { Élève: name(f.studentId), Ligne: "Frais", Libellé: f.label, Date: day(f.dueDate), Montant: f.amount, Reçu: "", Mode: "" },
        ...f.payments.map((p) => ({ Élève: name(f.studentId), Ligne: "Paiement", Libellé: f.label, Date: day(p.paidAt), Montant: p.amount, Reçu: p.receiptNumber, Mode: p.method })),
      ]),
      "Reçus annulés": cancelled.map((c) => ({
        Élève: c.studentName, Reçu: c.receiptNumber, Montant: c.amount, Annulé: day(c.cancelledAt), Motif: c.cancelReason,
      })),
      Présences: attendance.map((a) => ({ Élève: name(a.studentId), Date: day(a.date), Statut: a.status, Note: a.note })),
      Notes: grades.map((g) => ({
        Élève: name(g.studentId), Matière: g.exam.subject.name, Examen: g.exam.title, Trimestre: g.exam.term,
        Date: day(g.exam.date), Note: g.isAbsent ? "absent" : g.score, Barème: g.exam.maxScore,
      })),
      Discipline: incidents.map((i) => ({ Élève: name(i.studentId), Date: day(i.date), Type: i.type, Description: i.description, Sanction: i.sanction })),
      Appréciations: comments.map((c) => ({ Élève: name(c.studentId), Trimestre: c.term, Appréciation: c.body, "Appréciation (arabe)": c.bodyAr })),
      "Décisions de fin d'année": decisions.map((d) => ({ Élève: name(d.studentId), Décision: d.decision, Moyenne: d.average })),
      "Rappels envoyés": reminders.map((r) => ({ Date: day(r.sentAt), Montant: r.amount, Mois: r.months, Par: r.userName })),
    };

    await logActivity(basePrisma, {
      schoolId: user.schoolId,
      userId: user.id,
      action: ACTIVITY_ACTIONS.EXPORT,
      summary: `Export des données de la famille ${familyLabel(parent, "Famille {name}")}`,
    });
    return { fileName: `donnees-famille-${parent.lastName.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`, sheets };
  });
}
