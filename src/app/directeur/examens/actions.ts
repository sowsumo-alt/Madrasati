"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { CURRENT_YEAR } from "@/lib/school-year";
import { examGroupKey } from "@/lib/exam-groups";
import {
  examSchema,
  examEditSchema,
  examScopeSchema,
  type ExamFormValues,
  type ExamEditValues,
  type ExamScope,
} from "./schema";
import { assertClassAccess } from "@/lib/teacher-scope";

export interface CreateExamResult {
  /** Nombre d'examens réellement planifiés. */
  created: number;
  /** Classes qui avaient déjà cet examen, et pour lesquelles rien n'a été refait. */
  alreadyPlanned: string[];
}

/**
 * Planifie un examen pour une ou plusieurs classes en une seule opération.
 *
 * Chaque classe reçoit son propre examen — ses élèves, ses notes et parfois
 * son enseignant lui sont propres — mais tous partagent titre, date, matière,
 * durée et note maximale, ce qui suffit à les réunir à l'affichage (voir
 * lib/exam-groups.ts).
 */
export async function createExam(values: ExamFormValues): Promise<CreateExamResult> {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = examSchema.parse(values);

  const year = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isCurrent: true },
  });
  if (!year) throw new Error("Aucune année scolaire active.");

  // Doublons de la liste ignorés : cocher deux fois la même classe ne doit pas
  // lui créer deux examens identiques.
  const classIds = [...new Set(data.classIds)];

  const classes = await prisma.classRoom.findMany({
    where: { id: { in: classIds }, schoolId: user.schoolId, ...CURRENT_YEAR },
    select: {
      id: true,
      name: true,
      classSubjects: { where: { subjectId: data.subjectId }, select: { id: true } },
    },
  });
  if (classes.length !== classIds.length) {
    throw new Error("Une des classes sélectionnées est introuvable.");
  }

  // La matière doit être enseignée dans chaque classe retenue : sans ce
  // contrôle, l'examen créerait sur le bulletin une ligne pour une matière qui
  // n'est pas au programme de la classe.
  const withoutSubject = classes.filter((c) => c.classSubjects.length === 0);
  if (withoutSubject.length > 0) {
    throw new Error(
      `Cette matière n'est pas enseignée en ${withoutSubject.map((c) => c.name).join(", ")}.`,
    );
  }

  const date = new Date(data.date);

  // Un examen déjà planifié (même titre, même jour, même matière, même classe)
  // n'est pas recréé : le directeur qui revient sur le formulaire pour ajouter
  // une classe oubliée ne doit pas se retrouver avec des doublons.
  const existing = await prisma.exam.findMany({
    where: {
      schoolId: user.schoolId,
      subjectId: data.subjectId,
      classId: { in: classIds },
      title: data.title,
      date,
    },
    select: { classId: true },
  });
  const alreadyPlannedIds = new Set(existing.map((e) => e.classId));

  const toCreate = classes.filter((c) => !alreadyPlannedIds.has(c.id));

  if (toCreate.length > 0) {
    await prisma.exam.createMany({
      data: toCreate.map((c) => ({
        schoolId: user.schoolId,
        academicYearId: year.id,
        classId: c.id,
        subjectId: data.subjectId,
        title: data.title,
        term: data.term,
        date,
        durationMinutes: data.durationMinutes ? Number(data.durationMinutes) : null,
        maxScore: data.maxScore,
      })),
    });
  }

  revalidatePath("/directeur/examens");
  revalidatePath("/enseignant/notes");
  revalidatePath("/directeur");

  return {
    created: toCreate.length,
    alreadyPlanned: classes.filter((c) => alreadyPlannedIds.has(c.id)).map((c) => c.name),
  };
}

/**
 * Examens visés par une action selon sa portée : le seul examen désigné, ou
 * tous ceux du même examen commun (même titre, même jour, même matière).
 */
async function examsInScope(schoolId: string, examId: string, scope: ExamScope) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    select: { id: true, title: true, date: true, subjectId: true },
  });
  if (!exam) throw new Error("Examen introuvable.");

  if (scope === "one") return { exam, ids: [exam.id] };

  // Le groupe est recalculé côté serveur plutôt que reçu du navigateur : une
  // liste d'identifiants envoyée par le client pourrait viser les examens
  // d'une autre école.
  const key = examGroupKey({
    title: exam.title,
    date: exam.date.toISOString(),
    subjectId: exam.subjectId,
  });
  const sameDay = await prisma.exam.findMany({
    where: { schoolId, subjectId: exam.subjectId, date: exam.date },
    select: { id: true, title: true, date: true, subjectId: true },
  });
  const ids = sameDay
    .filter(
      (e) =>
        examGroupKey({
          title: e.title,
          date: e.date.toISOString(),
          subjectId: e.subjectId,
        }) === key,
    )
    .map((e) => e.id);

  return { exam, ids };
}

/** Modifie un examen, pour sa seule classe ou pour toutes celles qui le partagent. */
export async function updateExam(
  examId: string,
  values: ExamEditValues,
  scope: ExamScope = "one",
) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = examEditSchema.parse(values);
  const parsedScope = examScopeSchema.parse(scope);

  const { ids } = await examsInScope(user.schoolId, examId, parsedScope);

  await prisma.exam.updateMany({
    where: { id: { in: ids }, schoolId: user.schoolId },
    data: {
      title: data.title,
      term: data.term,
      date: new Date(data.date),
      durationMinutes: data.durationMinutes ? Number(data.durationMinutes) : null,
      maxScore: data.maxScore,
    },
  });

  revalidatePath("/directeur/examens");
  revalidatePath("/enseignant/notes");
  revalidatePath("/directeur");
  return { updated: ids.length };
}

/** Supprime un examen, pour sa seule classe ou pour toutes celles qui le partagent. */
export async function deleteExam(examId: string, scope: ExamScope = "one") {
  const user = await requireRole(ROLES.DIRECTOR);
  const parsedScope = examScopeSchema.parse(scope);

  const { ids } = await examsInScope(user.schoolId, examId, parsedScope);

  await prisma.exam.deleteMany({ where: { id: { in: ids }, schoolId: user.schoolId } });

  revalidatePath("/directeur/examens");
  revalidatePath("/enseignant/notes");
  revalidatePath("/directeur");
  return { deleted: ids.length };
}

interface GradeEntry {
  studentId: string;
  score: string;
  isAbsent: boolean;
}

export async function saveGrades(examId: string, entries: GradeEntry[]) {
  const user = await requireRole(ROLES.DIRECTOR, ROLES.TEACHER);

  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId: user.schoolId },
  });
  if (!exam) throw new Error("Examen introuvable.");

  // Un enseignant ne peut noter que dans ses propres classes.
  await assertClassAccess(user, exam.classId);

  const studentsInClass = await prisma.student.findMany({
    where: { schoolId: user.schoolId, classId: exam.classId },
    select: { id: true },
  });
  const allowedIds = new Set(studentsInClass.map((s) => s.id));

  for (const entry of entries) {
    if (!allowedIds.has(entry.studentId)) continue;

    const parsed = entry.score === "" ? null : Number(entry.score);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0 || parsed > exam.maxScore)) {
      throw new Error(`Chaque note doit être comprise entre 0 et ${exam.maxScore}.`);
    }

    await prisma.grade.upsert({
      where: { examId_studentId: { examId, studentId: entry.studentId } },
      create: {
        examId,
        studentId: entry.studentId,
        score: entry.isAbsent ? null : parsed,
        isAbsent: entry.isAbsent,
      },
      update: {
        score: entry.isAbsent ? null : parsed,
        isAbsent: entry.isAbsent,
      },
    });
  }

  // La moyenne et le compteur « notes saisies » de la page Examens sont
  // recalculés à chaque rendu : revalider suffit à les mettre à jour, sans que
  // personne ait à rafraîchir la page.
  revalidatePath("/directeur/examens");
  revalidatePath("/enseignant/notes");
  revalidatePath("/directeur");
}
