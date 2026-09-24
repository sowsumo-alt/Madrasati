import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { FEATURES, schoolHasFeature } from "@/lib/plans";
import {
  annualMissingTerms,
  buildReportCards,
  buildAnnualReportCards,
} from "@/lib/report-card-data";
import { ANNUAL_TERM } from "@/lib/report-card-compute";
import { currentGradingConfig } from "@/lib/grading-config-data";
import { TERMS } from "@/app/directeur/examens/schema";
import { BulletinsView, type BulletinRow } from "./bulletins-view";
import { CURRENT_YEAR } from "@/lib/school-year";

const DEFAULT_GRADES_TEMPLATE =
  "Bonjour {parentName},\n\nLes notes de {studentName} sont désormais disponibles (moyenne générale : {average}/20). N'hésitez pas à nous contacter pour en discuter.\n\n{schoolName}";
const DEFAULT_GRADES_TEMPLATE_AR =
  "مرحبًا {parentName}،\n\nأصبح كشف نقاط {studentName} متوفرًا الآن (المعدل العام: {average}/20). لا تترددوا في الاتصال بنا لمناقشته.\n\n{schoolName}";

export default async function BulletinsPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; term?: string }>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const params = await searchParams;

  const classes = await prisma.classRoom.findMany({
    where: { schoolId: user.schoolId, ...CURRENT_YEAR },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const selectedClassId =
    params.classId && classes.some((c) => c.id === params.classId)
      ? params.classId
      : (classes[0]?.id ?? "");
  // Trimestre proposé par défaut : le premier qui porte réellement un examen
  // dans cette classe. Retomber systématiquement sur le Trimestre 1 affichait
  // une page vide au directeur qui vient de noter une composition du
  // Trimestre 2 — sans rien lui indiquer.
  const examTerms = selectedClassId
    ? await prisma.exam.findMany({
        where: { schoolId: user.schoolId, classId: selectedClassId },
        select: { term: true },
        distinct: ["term"],
      })
    : [];
  const termsWithExams = new Set(examTerms.map((e) => e.term));
  // Le bulletin annuel n'est proposé que si l'école l'a activé dans sa règle
  // de calcul (Paramètres → Calcul des moyennes).
  const rule = await currentGradingConfig(user.schoolId);
  const terms = rule.config.annual.enabled ? [...TERMS, ANNUAL_TERM] : [...TERMS];
  const selectedTerm =
    params.term && terms.includes(params.term)
      ? params.term
      : (TERMS.find((t) => termsWithExams.has(t)) ?? TERMS[0]);
  const isAnnual = selectedTerm === ANNUAL_TERM;
  // Le bulletin annuel ne s'établit qu'une fois les trois compositions saisies.
  const annualMissing =
    isAnnual && selectedClassId ? await annualMissingTerms(user.schoolId, selectedClassId) : [];

  const [cards, parents, school, template] = await Promise.all([
    selectedClassId
      ? isAnnual
        ? annualMissing.length > 0
          ? Promise.resolve([])
          : buildAnnualReportCards(user.schoolId, selectedClassId, rule.config)
        : buildReportCards(user.schoolId, selectedClassId, selectedTerm, rule.config)
      : Promise.resolve([]),
    prisma.studentParent.findMany({
      where: { isPrimary: true, student: { schoolId: user.schoolId } },
      include: { parent: true },
    }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true, plan: true, subscriptionStatus: true } }),
    prisma.messageTemplate.findFirst({
      where: { schoolId: user.schoolId, key: "GRADES_AVAILABLE" },
      select: { body: true, bodyAr: true },
    }),
  ]);

  const bilingual = schoolHasFeature(school, FEATURES.BILINGUAL_MESSAGES);

  const parentByStudent = new Map(parents.map((p) => [p.studentId, p.parent]));

  // Aucune moyenne peut vouloir dire deux choses très différentes : aucun
  // examen n'a été planifié, ou les examens existent mais ne sont pas notés.
  // La page le disait pareillement dans les deux cas — c'est-à-dire pas du tout.
  const hasExamThisTerm = isAnnual ? termsWithExams.size > 0 : termsWithExams.has(selectedTerm);

  const rows: BulletinRow[] = cards.map((c) => {
    const parent = parentByStudent.get(c.student.id);
    return {
      studentId: c.student.id,
      studentName: `${c.student.firstName} ${c.student.lastName}`,
      average: c.average,
      mention: c.mention,
      rank: c.rank,
      classSize: c.classSize,
      subjectsScored: c.results.filter((r) => r.average != null).length,
      parent: parent
        ? {
            firstName: parent.firstName,
            lastName: parent.lastName,
            phone: parent.phone,
          }
        : null,
    };
  });

  return (
    <BulletinsView
      rows={rows}
      classes={classes}
      terms={terms}
      annualMissing={annualMissing}
      selectedClassId={selectedClassId}
      selectedTerm={selectedTerm}
      hasExamThisTerm={hasExamThisTerm}
      schoolName={school?.name ?? "Madrasati"}
      gradesTemplate={template?.body ?? DEFAULT_GRADES_TEMPLATE}
      gradesTemplateAr={bilingual ? (template?.bodyAr ?? DEFAULT_GRADES_TEMPLATE_AR) : undefined}
    />
  );
}
