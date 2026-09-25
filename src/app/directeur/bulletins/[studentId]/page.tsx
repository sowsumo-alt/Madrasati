import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import {
  annualMissingTerms,
  buildReportCards,
  buildAnnualReportCards,
  classCardsWithRules,
  reportCardRule,
  termRecap,
} from "@/lib/report-card-data";
import { parseHonors, suggestDecision, isDecisionKey } from "@/lib/annual-decision";
import { AnnualDecisionPanel } from "./annual-decision-panel";
import { AnnualReportCard } from "./annual-report-card";
import { ReportCardActions } from "./report-card-actions";
import { StandardReportCard } from "./standard-report-card";
import { compareCards, missingGrades, previousTermOf } from "@/lib/report-card-checks";
import Link from "next/link";
import { ANNUAL_TERM } from "@/lib/report-card-compute";
import { markReportCardIssued } from "../actions";
import { RuleBanner } from "./rule-banner";
import { formatDate } from "@/lib/format";
import { TERMS } from "@/app/directeur/examens/schema";
import { isAiEnabled } from "@/lib/ai";
import { CommentEditor } from "./comment-editor";
import { getTranslations } from "@/lib/i18n/server";
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

  // Avant de générer : les notes qui manquent, et l'évolution depuis le
  // trimestre précédent (aucune au premier trimestre ni au bulletin annuel).
  const missing = missingGrades(card);
  const previousTerm = isAnnual ? null : previousTermOf(term, TERMS);
  const previousCard = previousTerm
    ? ((await classCardsWithRules(user.schoolId, student.classId, previousTerm)).find(
        (c) => c.student.id === studentId,
      ) ?? null)
    : null;
  const cardEvolution = compareCards(card, previousCard);
  const actions = (
    <ReportCardActions
      studentName={studentName}
      missing={missing}
      notesHref={
        isAnnual
          ? `/directeur/notes?classe=${student.classId}`
          : `/directeur/notes?classe=${student.classId}&trimestre=${encodeURIComponent(term)}`
      }
      elementId="bulletin-card"
      fileName={pdfFileName}
      parentPhone={parent?.phone ?? null}
      message={pdfMessage}
      onUse={onIssued}
    />
  );
  const ruleBanner =
    rule.outdated && rule.issuedAt ? (
      <RuleBanner studentId={studentId} term={term} issuedAt={formatDate(rule.issuedAt)} />
    ) : null;

  // Au 3e trimestre, l'année est finie : le bulletin annuel de l'élève est à
  // un clic, sans avoir à le chercher dans la liste des périodes.
  const annualLink =
    term === TERMS[TERMS.length - 1] && rule.config.annual.enabled ? (
      <Link
        href={`/directeur/bulletins/${studentId}?term=${encodeURIComponent(ANNUAL_TERM)}`}
        className="no-print mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary-300 bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-800 hover:bg-primary-100"
        data-testid="annual-link"
      >
        <span>{t("bulletin.annualLink")}</span>
        <span aria-hidden>→</span>
      </Link>
    ) : null;

  // Collège et lycée : le bulletin officiel mauritanien (meilleur devoir × 3
  // + composition, ÷ 4). Le Fondamental garde plus bas son bulletin d'origine.
  if (card.scheme === "SECONDARY") {
    const schoolIdentity = {
      name: school?.name ?? "Madrasati",
      address: school?.address ?? null,
      city: school?.city ?? null,
      phone: school?.phone ?? null,
      logoUrl: school?.logoUrl ?? null,
    };
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
        {actions}

        {annualLink}

        {/* Le document garde sa largeur sur téléphone et défile : le PDF
            envoyé au parent reste ainsi complet. */}
        <div className="overflow-x-auto pb-2 print:overflow-visible print:pb-0">
          {annualData ? (
            <AnnualReportCard
              id="bulletin-card"
              card={card}
              school={schoolIdentity}
              yearLabel={academicYear?.label ?? null}
              studentNumber={cards.indexOf(card) + 1}
              termRecap={annualData.termRecap}
              honors={annualData.honors}
              decision={annualData.decision}
              suggestion={annualData.suggestion}
              issuedAt={new Date()}
              incomplete={missing.length > 0}
            />
          ) : (
            <SecondaryReportCard
              id="bulletin-card"
              card={card}
              school={schoolIdentity}
              yearLabel={academicYear?.label ?? null}
              studentNumber={cards.indexOf(card) + 1}
              suspensions={suspensions}
              comment={comment ? { body: comment.body, bodyAr: comment.bodyAr } : null}
              issuedAt={new Date()}
              evolution={cardEvolution}
              incomplete={missing.length > 0}
            />
          )}
        </div>

        {decisionPanel}

        {/* L'observation générale s'écrit ici et s'imprime dans le cadre
            Conduite du bulletin trimestriel ; le bulletin annuel n'en a pas. */}
        <div className={isAnnual ? "hidden" : "no-print mx-auto mt-2 max-w-[900px]"}>
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
      {actions}
      {annualLink}

      <StandardReportCard
        id="bulletin-card"
        card={card}
        t={t}
        school={{
          name: school?.name ?? "Madrasati",
          address: school?.address ?? null,
          phone: school?.phone ?? null,
          logoUrl: school?.logoUrl ?? null,
        }}
        yearLabel={academicYear?.label ?? null}
        photoUrl={student.photoUrl}
        evolution={cardEvolution}
        incomplete={missing.length > 0}
        commentSlot={
          <CommentEditor
            studentId={studentId}
            term={term}
            initialBody={comment?.body ?? ""}
            initialBodyAr={comment?.bodyAr ?? ""}
            isAiGenerated={comment?.isAiGenerated ?? false}
            aiEnabled={isAiEnabled()}
          />
        }
      />

      {decisionPanel}
    </div>
  );
}
