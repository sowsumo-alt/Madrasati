import Image from "next/image";
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
import { SendPdfButton } from "./send-pdf-button";
import { getTranslations } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { FEATURES, schoolHasFeature } from "@/lib/plans";
import { DEFAULT_TEMPLATES } from "@/lib/school-setup";
import { fillTemplate, withArabic, schoolSignatureFr, schoolSignatureAr } from "@/lib/whatsapp";

const DEFAULT_GRADES_TEMPLATE = DEFAULT_TEMPLATES.find((t) => t.key === "GRADES_AVAILABLE")!;

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

  const [cards, school, academicYear, comment, parentLink, template] = await Promise.all([
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
    prisma.studentParent.findFirst({
      where: { studentId, isPrimary: true },
      include: { parent: { select: { firstName: true, lastName: true, phone: true } } },
    }),
    prisma.messageTemplate.findFirst({
      where: { schoolId: user.schoolId, key: "GRADES_AVAILABLE" },
      select: { body: true, bodyAr: true },
    }),
  ]);

  const card = cards.find((c) => c.student.id === studentId);
  if (!card) notFound();

  const { t } = await getTranslations();

  const bilingual = schoolHasFeature(school, FEATURES.BILINGUAL_MESSAGES);
  const parent = parentLink?.parent ?? null;
  const studentName = `${card.student.firstName} ${card.student.lastName}`;
  const averageLabel = card.average != null ? card.average.toFixed(2) : "—";
  const pdfMessage = parent
    ? withArabic(
        fillTemplate(template?.body ?? DEFAULT_GRADES_TEMPLATE.body, {
          parentName: `${parent.firstName} ${parent.lastName}`,
          studentName,
          average: averageLabel,
          schoolName: schoolSignatureFr(school?.name ?? "Madrasati"),
        }),
        bilingual
          ? fillTemplate(template?.bodyAr ?? DEFAULT_GRADES_TEMPLATE.bodyAr, {
              parentName: `${parent.firstName} ${parent.lastName}`,
              studentName,
              average: averageLabel,
              schoolName: schoolSignatureAr(school?.name ?? "Madrasati"),
            })
          : undefined,
      )
    : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="no-print mb-6 flex justify-end gap-2">
        <SendPdfButton
          elementId="bulletin-card"
          fileName={`Bulletin-${studentName}-${term}.pdf`}
          parentPhone={parent?.phone ?? null}
          message={pdfMessage}
        />
        <PrintButton label={t("bulletin.print")} />
      </div>

      <div
        id="bulletin-card"
        className="rounded-xl border border-border bg-surface p-8 shadow-sm print:border-0 print:p-0 print:shadow-none"
      >
        <div className="flex items-start justify-between border-b border-border pb-6">
          <div className="flex items-center gap-3 text-primary-800">
            {school?.logoUrl ? (
              <Image
                src={school.logoUrl}
                alt=""
                width={320}
                height={320}
                unoptimized
                className="h-14 w-14 rounded object-contain"
              />
            ) : (
              <GraduationCap className="h-8 w-8" strokeWidth={2} />
            )}
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
              {t("bulletin.reportCardTitle")}
            </p>
            <p className="text-sm font-semibold text-foreground">{card.term}</p>
            {academicYear && (
              <p className="text-xs text-foreground/50">
                {t("bulletin.year")} {academicYear.label}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 py-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              {t("finance.student")}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm font-medium text-foreground">
              {student.photoUrl && (
                <Image
                  src={student.photoUrl}
                  alt=""
                  width={240}
                  height={240}
                  unoptimized
                  className="h-10 w-10 rounded-full object-cover"
                />
              )}
              {card.student.firstName} {card.student.lastName}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              {t("students.class")}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {card.className}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              {t("bulletin.attendance")}
            </p>
            <p className="mt-1 text-sm text-foreground">
              {card.attendance.absent} {t("bulletin.absences")}, {card.attendance.late}{" "}
              {t("bulletin.lates")}
            </p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
              <th className="px-3 py-2.5">{t("bulletin.subject")}</th>
              <th className="px-3 py-2.5 text-center">{t("bulletin.coefficient")}</th>
              <th className="px-3 py-2.5 text-center">{t("bulletin.average")}</th>
              <th className="px-3 py-2.5 text-center">{t("bulletin.classAverage")}</th>
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
              {t("bulletin.overallAverage")}
            </p>
            <p className="mt-1 text-xl font-semibold text-primary-800">
              {card.average != null ? `${card.average.toFixed(2)} / 20` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              {t("bulletin.mentionLabel")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {t(`bulletin.mention.${card.mention}` as TranslationKey)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              {t("bulletin.rank")}
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
            <p className="mb-8">{t("bulletin.directorSignature")}</p>
            <div className="w-40 border-t border-border" />
          </div>
          <div className="text-right">
            <p className="mb-8">{t("bulletin.parentSignature")}</p>
            <div className="ml-auto w-40 border-t border-border" />
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-foreground/40">
          {t("bulletin.footer")}
        </p>
      </div>
    </div>
  );
}
