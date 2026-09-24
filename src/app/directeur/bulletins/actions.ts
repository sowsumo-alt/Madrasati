"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import {
  ANNUAL_TERM,
  buildAnnualReportCards,
  buildReportCards,
  reportCardRule,
} from "@/lib/report-card-data";
import { isDecisionKey, parseHonors } from "@/lib/annual-decision";
import { generateAppreciation, isAiEnabled } from "@/lib/ai";
import { currentGradingConfig, saveGradingConfig } from "@/lib/grading-config-data";
import { defaultGradingConfig } from "@/lib/grading-config";

export async function saveComment(
  studentId: string,
  term: string,
  body: string,
  bodyAr: string,
) {
  const user = await requireRole(ROLES.DIRECTOR);

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: user.schoolId },
  });
  if (!student) throw new Error("Élève introuvable.");

  const trimmed = body.trim();
  const trimmedAr = bodyAr.trim();

  if (!trimmed && !trimmedAr) {
    await prisma.reportCardComment.deleteMany({ where: { studentId, term } });
  } else {
    await prisma.reportCardComment.upsert({
      where: { studentId_term: { studentId, term } },
      create: {
        schoolId: user.schoolId,
        studentId,
        term,
        body: trimmed,
        bodyAr: trimmedAr || null,
        isAiGenerated: false,
      },
      update: { body: trimmed, bodyAr: trimmedAr || null, isAiGenerated: false },
    });
  }

  revalidatePath("/directeur/bulletins");
  revalidatePath(`/directeur/bulletins/${studentId}`);
}

export async function generateComment(studentId: string, term: string) {
  const user = await requireRole(ROLES.DIRECTOR);

  if (!isAiEnabled()) {
    throw new Error(
      "L'appréciation automatique n'est pas activée. Ajoutez votre clé API dans le fichier .env.",
    );
  }

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: user.schoolId },
  });
  if (!student?.classId) throw new Error("Élève introuvable ou sans classe.");

  const cards = await buildReportCards(user.schoolId, student.classId, term);
  const card = cards.find((c) => c.student.id === studentId);
  if (!card) throw new Error("Bulletin introuvable.");

  if (card.results.every((r) => r.average == null)) {
    throw new Error("Aucune note saisie pour ce trimestre.");
  }

  const { fr, ar } = await generateAppreciation(card);

  await prisma.reportCardComment.upsert({
    where: { studentId_term: { studentId, term } },
    create: {
      schoolId: user.schoolId,
      studentId,
      term,
      body: fr,
      bodyAr: ar || null,
      isAiGenerated: true,
    },
    update: { body: fr, bodyAr: ar || null, isAiGenerated: true },
  });

  revalidatePath("/directeur/bulletins");
  revalidatePath(`/directeur/bulletins/${studentId}`);
  return { body: fr, bodyAr: ar };
}

/**
 * Trace qu'un bulletin part chez le parent — imprimé ou exporté en PDF — et
 * fige la règle de calcul avec laquelle il a été établi.
 *
 * C'est ce qui empêche un changement de règle en cours d'année de réécrire
 * un document déjà distribué : tant que cette trace existe, le bulletin est
 * recalculé avec la règle de ce jour-là.
 */
export async function markReportCardIssued(studentId: string, term: string) {
  const user = await requireRole(ROLES.DIRECTOR);

  const [student, year, rule] = await Promise.all([
    prisma.student.findFirst({
      where: { id: studentId, schoolId: user.schoolId },
      select: { id: true },
    }),
    prisma.academicYear.findFirst({
      where: { schoolId: user.schoolId, isCurrent: true },
      select: { id: true },
    }),
    currentGradingConfig(user.schoolId),
  ]);
  if (!student || !year) return;

  // L'école suit encore le modèle livré : on l'enregistre comme sa version 1,
  // sinon il n'y aurait rien à figer et le bulletin suivrait ses réglages
  // futurs.
  const configId =
    rule.id ??
    (await saveGradingConfig(user.schoolId, defaultGradingConfig(), user.id)).id;

  await prisma.reportCardIssue.upsert({
    where: { studentId_academicYearId_term: { studentId, academicYearId: year.id, term } },
    // Déjà remis : la règle d'origine reste celle qui fait foi.
    update: {},
    create: {
      schoolId: user.schoolId,
      studentId,
      academicYearId: year.id,
      term,
      gradingConfigId: configId,
      issuedByUserId: user.id,
    },
  });
}

/**
 * Rattache le bulletin à la règle de calcul actuelle, à la demande du
 * directeur — par exemple après avoir corrigé sa configuration.
 */
export async function refreshReportCardRule(studentId: string, term: string) {
  const user = await requireRole(ROLES.DIRECTOR);

  const [year, rule] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { schoolId: user.schoolId, isCurrent: true },
      select: { id: true },
    }),
    currentGradingConfig(user.schoolId),
  ]);
  if (!year) return;

  await prisma.reportCardIssue.updateMany({
    where: { studentId, schoolId: user.schoolId, academicYearId: year.id, term },
    data: { gradingConfigId: rule.id },
  });

  revalidatePath(`/directeur/bulletins/${studentId}`);
}

/**
 * Mentions du conseil et décision de passage d'un élève, validées par le
 * directeur sur son bulletin annuel. La moyenne annuelle du jour est
 * recopiée, pour que la page Réinscription l'affiche l'an prochain.
 */
export async function saveAnnualDecision(
  studentId: string,
  values: { honors: string[]; decision: string | null },
) {
  const user = await requireRole(ROLES.DIRECTOR);

  const honors = parseHonors(values.honors);
  const decision = values.decision == null ? null : isDecisionKey(values.decision) ? values.decision : null;
  if (values.decision != null && decision == null) throw new Error("Décision inconnue.");

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: user.schoolId },
    select: { id: true, classId: true, classRoom: { select: { academicYearId: true } } },
  });
  if (!student?.classId || !student.classRoom) throw new Error("Élève introuvable ou sans classe.");
  const academicYearId = student.classRoom.academicYearId;

  const rule = await reportCardRule({
    schoolId: user.schoolId,
    studentId,
    academicYearId,
    term: ANNUAL_TERM,
  });
  const cards = await buildAnnualReportCards(user.schoolId, student.classId, rule.config);
  const average = cards.find((c) => c.student.id === studentId)?.average ?? null;

  const data = {
    honors,
    decision,
    average,
    validatedAt: decision ? new Date() : null,
    validatedByUserId: decision ? user.id : null,
  };
  await prisma.annualDecision.upsert({
    where: { studentId_academicYearId: { studentId, academicYearId } },
    create: { schoolId: user.schoolId, studentId, academicYearId, ...data },
    update: data,
  });

  revalidatePath(`/directeur/bulletins/${studentId}`);
  revalidatePath("/directeur/bulletins");
  revalidatePath("/directeur/reinscription");
}
