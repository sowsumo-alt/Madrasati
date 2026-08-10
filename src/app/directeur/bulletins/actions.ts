"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { buildReportCards } from "@/lib/report-card-data";
import { generateAppreciation, isAiEnabled } from "@/lib/ai";

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
