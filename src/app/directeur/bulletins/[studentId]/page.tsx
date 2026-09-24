import Image from "next/image";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import {
  annualMissingTerms,
  buildReportCards,
  buildAnnualReportCards,
  reportCardRule,
  termRecap,
} from "@/lib/report-card-data";
import { parseHonors, suggestDecision, isDecisionKey } from "@/lib/annual-decision";
import { AnnualDecisionPanel } from "./annual-decision-panel";
import Link from "next/link";
import { ANNUAL_TERM } from "@/lib/report-card-compute";
import { markReportCardIssued } from "../actions";
import { RuleBanner } from "./rule-banner";
import { formatDate } from "@/lib/format";
import { TERMS } from "@/app/directeur/examens/schema";
import { PrintButton } from "@/components/ui/print-button";
import { GraduationCap } from "lucide-react";
import { isAiEnabled } from "@/lib/ai";
import { CommentEditor } from "./comment-editor";
import { PdfButton } from "@/components/ui/pdf-button";
import { getTranslations } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { FEATURES, schoolHasFeature } from "@/lib/plans";
import { DEFAULT_TEMPLATES } from "@/lib/school-setup";
import { fillTemplate, withArabic, schoolSignatureFr, schoolSignatureAr } from "@/lib/whatsapp";
import { termDateRange } from "@/lib/report-card";
import { SecondaryReportCard } from "./secondary-report-card";

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
    termParam && [...TERMS, ANNUAL_TERM].includes(termParam) ? termParam : TERMS[0];
  const isAnnual = term === ANNUAL_TERM;

  // La règle de calcul : celle d'aujourd'hui, ou celle avec laquelle ce
  // bulletin a déjà été remis au parent.
  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isCurrent: true },
    select: { id: true },
  });
  const rule = await reportCardRule({
    schoolId: user.schoolId,
    studentId,
    academicYearId: activeYear?.id ?? null,
    term,
  });

  const [cards, school, academicYear, comment, parentLink, template] = await Promise.all([
    isAnnual
      ? buildAnnualReportCards(user.schoolId, student.classId, rule.config)
      : buildReportCards(user.schoolId, student.classId, term, rule.config),
    prisma.school.findUnique({ where: { id: user.schoolId } }),
    prisma.academicYear.findFirst({
      where: { schoolId: user.schoolId, isCurrent: true },
      select: { label: true, startDate: true, endDate: true },
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

  // Le bulletin annuel ne s'établit qu'une fois l'année finie : quand les
  // compositions des trois trimestres sont saisies.
  if (isAnnual) {
    const missing = rule.config.annual.enabled
      ? await annualMissingTerms(user.schoolId, student.classId)
      : null;
    if (missing === null || missing.length > 0) {
      const { t: tr } = await getTranslations();
      return (
        <div className="mx-auto max-w-2xl px-4 py-16">
          <div
            className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 text-amber-900"
            data-testid="annual-unavailable"
          >
            <h1 className="text-lg font-semibold">{tr("annual.unavailableTitle")}</h1>
            <p className="mt-2 text-sm leading-relaxed">
              {missing === null
                ? tr("annual.disabled")
                : tr("annual.missingTerms").replace("{terms}", missing.join(", "))}
            </p>
            <Link
              href={`/directeur/bulletins?classId=${student.classId}`}
              className="mt-4 inline-block text-sm font-semibold underline"
            >
              {tr("annual.back")}
            </Link>
          </div>
        </div>
      );
    }
  }

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

  const pdfFileName = `Bulletin-${studentName}-${term}.pdf`;

  // Bulletin annuel : l'évolution sur les trimestres, et la fin d'année.
  const annualData = isAnnual
    ? await (async () => {
        const academicYearId = student.classRoom?.academicYearId ?? activeYear?.id ?? null;
        const [recap, decision] = await Promise.all([
          termRecap({
            schoolId: user.schoolId,
            classId: student.classId!,
            studentId,
            academicYearId,
          }),
          academicYearId
            ? prisma.annualDecision.findUnique({
                where: { studentId_academicYearId: { studentId, academicYearId } },
              })
            : null,
        ]);
        return {
          termRecap: recap,
          honors: parseHonors(decision?.honors),
          decision: isDecisionKey(decision?.decision) ? decision.decision : null,
          validatedAt: decision?.validatedAt ?? null,
          threshold: rule.config.annual.passThreshold,
          suggestion: suggestDecision(card.average, rule.config.annual.passThreshold),
        };
      })()
    : null;
  const decisionPanel = annualData ? (
    <AnnualDecisionPanel
      studentId={studentId}
      average={card.average}
      threshold={annualData.threshold}
      suggestion={annualData.suggestion}
      initialHonors={annualData.honors}
      initialDecision={annualData.decision}
      validatedAt={annualData.validatedAt ? formatDate(annualData.validatedAt) : null}
    />
  ) : null;
  // Imprimer ou envoyer le bulletin le fige sur la règle du jour.
  const onIssued = markReportCardIssued.bind(null, studentId, term);
  const ruleBanner =
    rule.outdated && rule.issuedAt ? (
      <RuleBanner studentId={studentId} term={term} issuedAt={formatDate(rule.issuedAt)} />
    ) : null;

  // Collège et lycée : le bulletin officiel mauritanien (meilleur devoir × 3
  // + composition, ÷ 4). Le Fondamental garde plus bas son bulletin d'origine.
  if (card.scheme === "SECONDARY") {
    const range = academicYear ? termDateRange(academicYear, term) : null;
    const suspensions = range
      ? await prisma.disciplineIncident.count({
          where: {
            schoolId: user.schoolId,
            studentId,
            type: "SUSPENSION",
            date: { gte: range.start, lte: range.end },
          },
        })
      : 0;

    return (
      <div className="mx-auto max-w-[62rem] px-4 py-10 print:max-w-none print:p-0">
        {ruleBanner}
        <div className="no-print mb-6 flex flex-wrap justify-end gap-2">
          <PdfButton
            elementId="bulletin-card"
            fileName={pdfFileName}
            labelKey="bulletin.sendPdf"
            parentPhone={parent?.phone ?? null}
            message={pdfMessage}
            onUse={onIssued}
          />
          <PrintButton label={t("bulletin.print")} onUse={onIssued} />
        </div>

        {/* Le document garde sa largeur sur téléphone et défile : le PDF
            envoyé au parent reste ainsi complet. */}
        <div className="overflow-x-auto pb-2 print:overflow-visible print:pb-0">
          <SecondaryReportCard
            id="bulletin-card"
            card={card}
            school={{
              name: school?.name ?? "Madrasati",
              address: school?.address ?? null,
              city: school?.city ?? null,
              phone: school?.phone ?? null,
              logoUrl: school?.logoUrl ?? null,
            }}
            yearLabel={academicYear?.label ?? null}
            title={isAnnual ? "Bulletin annuel" : undefined}
            periodLabel={
              isAnnual ? `${ANNUAL_TERM}${academicYear ? ` ${academicYear.label}` : ""}` : undefined
            }
            studentNumber={cards.indexOf(card) + 1}
            suspensions={suspensions}
            comment={comment ? { body: comment.body, bodyAr: comment.bodyAr } : null}
            issuedAt={new Date()}
            annual={
              annualData
                ? {
                    termRecap: annualData.termRecap,
                    honors: annualData.honors,
                    decision: annualData.decision,
                  }
                : undefined
            }
          />
        </div>

        {decisionPanel}

        {/* L'observation générale s'écrit ici et s'imprime dans le cadre
            Conduite du bulletin, pas en double sous le document. */}
        <div className="no-print mx-auto mt-2 max-w-[900px]">
          <CommentEditor
            studentId={studentId}
            term={term}
            initialBody={comment?.body ?? ""}
            initialBodyAr={comment?.bodyAr ?? ""}
            isAiGenerated={comment?.isAiGenerated ?? false}
            aiEnabled={isAiEnabled()}
            printCopy={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {ruleBanner}
      <div className="no-print mb-6 flex flex-wrap justify-end gap-2">
        <PdfButton
          elementId="bulletin-card"
          fileName={pdfFileName}
          labelKey="bulletin.sendPdf"
          parentPhone={parent?.phone ?? null}
          message={pdfMessage}
          onUse={onIssued}
        />
        <PrintButton label={t("bulletin.print")} onUse={onIssued} />
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

      {decisionPanel}
    </div>
  );
}
