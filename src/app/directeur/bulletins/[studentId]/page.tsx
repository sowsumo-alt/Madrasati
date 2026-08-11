import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { buildReportCards } from "@/lib/report-card-data";
import { TERMS } from "@/app/directeur/examens/schema";
import { PrintButton } from "@/components/ui/print-button";
import { GraduationCap } from "lucide-react";
import { isAiEnabled } from "@/lib/ai";
import { CommentEditor } from "./comment-editor";

export default async function ReportCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ term?: string }>;
}) {
  const { studentId } = await params;
  const { term: termParam } = await searchParams;
  const user = await requireRole(ROLES.DIRECTOR);

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: user.schoolId },
    include: { classRoom: true },
  });
  if (!student || !student.classId) notFound();

  const term =
    termParam && (TERMS as readonly string[]).includes(termParam)
      ? termParam
      : TERMS[0];

  const [cards, school, academicYear, comment] = await Promise.all([
    buildReportCards(user.schoolId, student.classId, term),
    prisma.school.findUnique({ where: { id: user.schoolId } }),
    prisma.academicYear.findFirst({
      where: { schoolId: user.schoolId, isCurrent: true },
      select: { label: true },
    }),
    prisma.reportCardComment.findUnique({
      where: { studentId_term: { studentId, term } },
      select: { body: true, bodyAr: true, isAiGenerated: true },
    }),
  ]);

  const card = cards.find((c) => c.student.id === studentId);
  if (!card) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="no-print mb-6 flex justify-end">
        <PrintButton label="Imprimer le bulletin" />
      </div>

      <div className="rounded-xl border border-border bg-surface p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-border pb-6">
          <div className="flex items-center gap-2 text-primary-800">
            <GraduationCap className="h-8 w-8" strokeWidth={2} />
            <div>
              <p className="text-base font-semibold leading-tight">{school?.name}</p>
              {school?.address && (
                <p className="text-xs text-foreground/50">{school.address}</p>
              )}
              {school?.phone && (
                <p className="text-xs text-foreground/50">{school.phone}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              Bulletin scolaire
            </p>
            <p className="text-sm font-semibold text-foreground">{card.term}</p>
            {academicYear && (
              <p className="text-xs text-foreground/50">
                Année {academicYear.label}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 py-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              Élève
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {card.student.firstName} {card.student.lastName}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              Classe
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {card.className}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              Assiduité
            </p>
            <p className="mt-1 text-sm text-foreground">
              {card.attendance.absent} absence(s), {card.attendance.late} retard(s)
            </p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
              <th className="px-3 py-2.5">Matière</th>
              <th className="px-3 py-2.5 text-center">Coef.</th>
              <th className="px-3 py-2.5 text-center">Moyenne</th>
              <th className="px-3 py-2.5 text-center">Moy. classe</th>
              <th className="px-3 py-2.5 text-right" dir="rtl" lang="ar">
                المادة
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {card.results.map((r) => (
              <tr key={r.subjectName}>
                <td className="px-3 py-2.5 text-foreground">{r.subjectName}</td>
                <td className="px-3 py-2.5 text-center text-foreground/70">
                  {r.coefficient}
                </td>
                <td className="px-3 py-2.5 text-center font-medium text-foreground">
                  {r.average != null ? r.average.toFixed(2) : "—"}
                </td>
                <td className="px-3 py-2.5 text-center text-foreground/60">
                  {r.classAverage != null ? r.classAverage.toFixed(2) : "—"}
                </td>
                <td
                  className="px-3 py-2.5 text-right text-foreground"
                  dir="rtl"
                  lang="ar"
                >
                  {r.subjectNameAr ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 grid grid-cols-3 gap-4 rounded-lg bg-surface-muted px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              Moyenne générale
            </p>
            <p className="mt-1 text-xl font-semibold text-primary-800">
              {card.average != null ? `${card.average.toFixed(2)} / 20` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              Mention
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {card.mention}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              Rang
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {card.rank != null ? `${card.rank} / ${card.classSize}` : "—"}
            </p>
          </div>
        </div>

        <CommentEditor
          studentId={studentId}
          term={term}
          initialBody={comment?.body ?? ""}
          initialBodyAr={comment?.bodyAr ?? ""}
          isAiGenerated={comment?.isAiGenerated ?? false}
          aiEnabled={isAiEnabled()}
        />

        <div className="mt-8 flex justify-between text-xs text-foreground/50">
          <div>
            <p className="mb-8">Signature du directeur</p>
            <div className="w-40 border-t border-border" />
          </div>
          <div className="text-right">
            <p className="mb-8">Signature du parent</p>
            <div className="ml-auto w-40 border-t border-border" />
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-foreground/40">
          Bulletin généré par Madrasati
        </p>
      </div>
    </div>
  );
}
