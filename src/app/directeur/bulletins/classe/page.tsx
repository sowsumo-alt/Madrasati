import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "@/lib/i18n/server";
import { FEATURES, schoolHasFeature } from "@/lib/plans";
import { DEFAULT_TEMPLATES } from "@/lib/school-setup";
import { fillTemplate, withArabic, schoolSignatureFr, schoolSignatureAr } from "@/lib/whatsapp";
import { termDateRange } from "@/lib/report-card";
import { classCardsWithRules } from "@/lib/report-card-data";
import { compareCards, missingGrades, previousTermOf } from "@/lib/report-card-checks";
import { TERMS } from "@/app/directeur/examens/schema";
import { SecondaryReportCard } from "../[studentId]/secondary-report-card";
import { StandardReportCard } from "../[studentId]/standard-report-card";
import { BulkGenerator, type BulkStudent } from "./bulk-generator";

const DEFAULT_GRADES_TEMPLATE = DEFAULT_TEMPLATES.find((t) => t.key === "GRADES_AVAILABLE")!;

/**
 * Tous les bulletins d'une classe pour un trimestre, préparés d'un coup :
 * notes manquantes repérées élève par élève, évolution depuis le trimestre
 * précédent, message WhatsApp de chaque parent. La génération elle-même se
 * lance depuis BulkGenerator.
 */
export default async function ClassReportCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; term?: string }>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const { classId, term: termParam } = await searchParams;
  const term = TERMS.find((t) => t === termParam);
  if (!classId || !term) notFound();

  const classRoom = await prisma.classRoom.findFirst({
    where: { id: classId, schoolId: user.schoolId },
    select: { id: true, name: true, academicYear: { select: { label: true, startDate: true, endDate: true } } },
  });
  if (!classRoom) notFound();

  const previousTerm = previousTermOf(term, TERMS);
  const [cards, previousCards, school, template, students] = await Promise.all([
    classCardsWithRules(user.schoolId, classId, term),
    previousTerm ? classCardsWithRules(user.schoolId, classId, previousTerm) : Promise.resolve([]),
    prisma.school.findUnique({ where: { id: user.schoolId } }),
    prisma.messageTemplate.findFirst({
      where: { schoolId: user.schoolId, key: "GRADES_AVAILABLE" },
      select: { body: true, bodyAr: true },
    }),
    prisma.student.findMany({
      where: { schoolId: user.schoolId, classId, status: "ACTIVE" },
      select: {
        id: true,
        photoUrl: true,
        parentLinks: {
          where: { isPrimary: true },
          take: 1,
          select: { parent: { select: { firstName: true, lastName: true, phone: true } } },
        },
      },
    }),
  ]);

  const studentIds = cards.map((c) => c.student.id);
  const range = termDateRange(classRoom.academicYear, term);
  const [comments, suspensions] = await Promise.all([
    prisma.reportCardComment.findMany({
      where: { studentId: { in: studentIds }, term },
      select: { studentId: true, body: true, bodyAr: true },
    }),
    prisma.disciplineIncident.groupBy({
      by: ["studentId"],
      where: {
        schoolId: user.schoolId,
        studentId: { in: studentIds },
        type: "SUSPENSION",
        date: { gte: range.start, lte: range.end },
      },
      _count: { _all: true },
    }),
  ]);

  const { t } = await getTranslations();
  const bilingual = schoolHasFeature(school, FEATURES.BILINGUAL_MESSAGES);
  const schoolInfo = {
    name: school?.name ?? "Madrasati",
    address: school?.address ?? null,
    city: school?.city ?? null,
    phone: school?.phone ?? null,
    logoUrl: school?.logoUrl ?? null,
  };

  const bulk: BulkStudent[] = cards.map((card, index) => {
    const studentName = `${card.student.firstName} ${card.student.lastName}`;
    const info = students.find((s) => s.id === card.student.id);
    const parent = info?.parentLinks[0]?.parent ?? null;
    const comment = comments.find((c) => c.studentId === card.student.id) ?? null;
    const missing = missingGrades(card);
    const cardEvolution = compareCards(
      card,
      previousCards.find((c) => c.student.id === card.student.id) ?? null,
    );
    const average = card.average != null ? card.average.toFixed(2) : "—";
    const fill = (body: string, ar: boolean) =>
      fillTemplate(body, {
        parentName: parent ? `${parent.firstName} ${parent.lastName}` : "",
        studentName,
        average,
        schoolName: ar ? schoolSignatureAr(schoolInfo.name) : schoolSignatureFr(schoolInfo.name),
      });
    const message = parent
      ? withArabic(
          fill(template?.body ?? DEFAULT_GRADES_TEMPLATE.body, false),
          bilingual ? fill(template?.bodyAr ?? DEFAULT_GRADES_TEMPLATE.bodyAr, true) : undefined,
        )
      : "";
    const id = `bulletin-${card.student.id}`;

    const document =
      card.scheme === "SECONDARY" ? (
        <SecondaryReportCard
          id={id}
          card={card}
          school={schoolInfo}
          yearLabel={classRoom.academicYear.label}
          studentNumber={index + 1}
          suspensions={suspensions.find((s) => s.studentId === card.student.id)?._count._all ?? 0}
          comment={comment ? { body: comment.body, bodyAr: comment.bodyAr } : null}
          issuedAt={new Date()}
          evolution={cardEvolution}
          incomplete={missing.length > 0}
        />
      ) : (
        <StandardReportCard
          id={id}
          card={card}
          t={t}
          school={schoolInfo}
          yearLabel={classRoom.academicYear.label}
          photoUrl={info?.photoUrl ?? null}
          evolution={cardEvolution}
          incomplete={missing.length > 0}
          commentSlot={
            comment ? (
              <div className="mt-6 border-t border-border pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
                  Appréciation / ملاحظة
                </p>
                <div className="mt-1 grid grid-cols-2 gap-6 text-sm leading-relaxed">
                  <p>{comment.body}</p>
                  <p dir="rtl" lang="ar">
                    {comment.bodyAr}
                  </p>
                </div>
              </div>
            ) : null
          }
        />
      );

    return {
      id: card.student.id,
      name: studentName,
      missing,
      parentPhone: parent?.phone ?? null,
      message,
      fileName: `Bulletin-${studentName}-${term}.pdf`,
      document,
    };
  });

  return (
    <div className="mx-auto max-w-[62rem] space-y-5 px-4 py-8 print:max-w-none print:p-0">
      <div className="no-print">
        <Link
          href={`/directeur/bulletins?classId=${classId}&term=${encodeURIComponent(term)}`}
          className="inline-flex items-center gap-1 text-sm text-foreground/60 hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          {t("annual.back")}
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          {t("bulletin.bulkTitle").replace("{class}", classRoom.name).replace("{term}", term)}
        </h1>
        <p className="mt-1 text-sm text-foreground/60">{t("bulletin.bulkSubtitle")}</p>
      </div>

      {bulk.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface px-5 py-16 text-center text-sm text-foreground/50">
          {t("grades.noStudents")}
        </p>
      ) : (
        <BulkGenerator
          className={classRoom.name}
          term={term}
          students={bulk}
          notesHref={`/directeur/notes?classe=${classId}&trimestre=${encodeURIComponent(term)}`}
        />
      )}
    </div>
  );
}
