import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { FEATURES, schoolHasFeature } from "@/lib/plans";
import { lettersOf } from "@/lib/initials";
import { paginatePayments, parsePaymentsParams } from "@/lib/payments-query";
import { FinanceView } from "./finance-view";
import { loadPaymentsData, withPhotos } from "./payments-data";

const DEFAULT_REMINDER =
  "Bonjour {parentName},\n\nNous vous rappelons que des frais de scolarité de {amount} MRU concernant {studentName} sont en attente de paiement, avec échéance au {date}. Merci de bien vouloir régulariser votre situation.\n\n{schoolName}";
const DEFAULT_REMINDER_AR =
  "مرحبًا {parentName}،\n\nنذكركم بأن مبلغ {amount} أوقية موريتانية الخاص بالرسوم الدراسية لـ {studentName} لا يزال معلقًا، وتاريخ الاستحقاق هو {date}. يرجى التكرم بتسوية وضعيتكم.\n\n{schoolName}";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  // Filtres et page dans l'adresse : le serveur calcule toute la liste avec
  // les mêmes règles, mais n'envoie au téléphone que la page affichée.
  const state = parsePaymentsParams(await searchParams);

  const [{ rows, kpis }, students, school, template] = await Promise.all([
    loadPaymentsData(user.schoolId),
    prisma.student.findMany({
      where: { schoolId: user.schoolId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, classRoom: { select: { name: true } } },
    }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true, plan: true, subscriptionStatus: true } }),
    prisma.messageTemplate.findFirst({
      where: { schoolId: user.schoolId, key: "PAYMENT_REMINDER" },
      select: { body: true, bodyAr: true },
    }),
  ]);

  const bilingual = schoolHasFeature(school, FEATURES.BILINGUAL_MESSAGES);
  // Famille d'un lien ?famille=<parentId> : ignorée si elle n'a aucun frais ici.
  const familyRows = state.family ? rows.filter((r) => r.parent?.id === state.family) : [];
  const family = familyRows.length > 0 ? state.family : null;
  const list = paginatePayments(rows, { ...state, family });

  const classNames = new Map<string, string>();
  for (const r of rows) if (r.student.classId && r.student.className) classNames.set(r.student.classId, r.student.className);

  return (
    <FinanceView
      state={{ ...state, family, page: list.page }}
      rows={await withPhotos(user.schoolId, list.rows)}
      total={list.total}
      pageCount={list.pageCount}
      hasFees={rows.length > 0}
      hasUnsettled={rows.some((r) => r.remaining > 0)}
      letters={lettersOf(rows.map((r) => `${r.student.firstName} ${r.student.lastName}`))}
      classes={[...classNames.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr"))}
      family={
        family
          ? {
              parent: familyRows[0].parent!,
              openFees: familyRows
                .filter((f) => f.remaining > 0)
                .map((f) => ({
                  feeId: f.id,
                  studentId: f.student.id,
                  studentName: `${f.student.firstName} ${f.student.lastName}`,
                  className: f.student.className,
                  label: f.label,
                  remaining: f.remaining,
                })),
            }
          : null
      }
      kpis={kpis}
      students={students.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        className: s.classRoom?.name ?? null,
      }))}
      schoolName={school?.name ?? "Madrasati"}
      reminderTemplate={template?.body ?? DEFAULT_REMINDER}
      reminderTemplateAr={bilingual ? (template?.bodyAr ?? DEFAULT_REMINDER_AR) : undefined}
    />
  );
}
