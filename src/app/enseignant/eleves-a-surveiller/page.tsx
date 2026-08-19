import { requireFeature } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { FEATURES, schoolHasFeature } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { getTeacherScope } from "@/lib/teacher-scope";
import { findAtRiskStudents } from "@/lib/at-risk";
import { fillTemplate, withArabic, schoolSignatureFr, schoolSignatureAr } from "@/lib/whatsapp";
import { AtRiskView, type AtRiskRow } from "@/app/directeur/eleves-a-surveiller/at-risk-view";

const DEFAULT_TEMPLATE =
  "Bonjour {parentName},\n\nNous avons remarqué que {studentName} pourrait avoir besoin d'un accompagnement supplémentaire en ce moment — {reason}. Nous serions heureux d'en discuter avec vous.\n\n{schoolName}";
const DEFAULT_TEMPLATE_AR =
  "مرحبًا {parentName}،\n\nلاحظنا أن {studentName} قد يحتاج إلى بعض المتابعة الإضافية حاليًا — {reason}. يسعدنا مناقشة الأمر معكم.\n\n{schoolName}";

export default async function TeacherAtRiskPage() {
  const user = await requireFeature(FEATURES.AT_RISK_DETECTION, ROLES.TEACHER);
  const scope = await getTeacherScope(user.id, user.schoolId);
  const classIds = scope?.classIds ?? [];

  const [students, school, template] = await Promise.all([
    classIds.length > 0 ? findAtRiskStudents(user.schoolId, classIds) : Promise.resolve([]),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true, plan: true, subscriptionStatus: true } }),
    prisma.messageTemplate.findFirst({
      where: { schoolId: user.schoolId, key: "AT_RISK_ALERT" },
      select: { body: true, bodyAr: true },
    }),
  ]);

  const schoolName = school?.name ?? "Madrasati";
  const bilingual = schoolHasFeature(school, FEATURES.BILINGUAL_MESSAGES);

  const rows: AtRiskRow[] = students.map((s) => {
    const reasonText = s.reasons.join(" · ");
    const message = s.parent
      ? withArabic(
          fillTemplate(template?.body ?? DEFAULT_TEMPLATE, {
            parentName: `${s.parent.firstName} ${s.parent.lastName}`,
            studentName: `${s.firstName} ${s.lastName}`,
            reason: reasonText,
            schoolName: schoolSignatureFr(schoolName),
          }),
          bilingual
            ? fillTemplate(template?.bodyAr ?? DEFAULT_TEMPLATE_AR, {
                parentName: `${s.parent.firstName} ${s.parent.lastName}`,
                studentName: `${s.firstName} ${s.lastName}`,
                reason: reasonText,
                schoolName: schoolSignatureAr(schoolName),
              })
            : null,
        )
      : "";

    return {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      className: s.className,
      reasons: s.reasons,
      parentPhone: s.parent?.phone ?? null,
      message,
    };
  });

  return <AtRiskView students={rows} scope="classes" />;
}
