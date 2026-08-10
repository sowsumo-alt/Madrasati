"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { examSchema, type ExamFormValues } from "./schema";
import { assertClassAccess } from "@/lib/teacher-scope";

export async function createExam(values: ExamFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = examSchema.parse(values);

  const year = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isCurrent: true },
  });
  if (!year) throw new Error("Aucune année scolaire active.");

  const cls = await prisma.classRoom.findFirst({
    where: { id: data.classId, schoolId: user.schoolId },
  });
  if (!cls) throw new Error("Classe introuvable.");

  await prisma.exam.create({
    data: {
      schoolId: user.schoolId,
      academicYearId: year.id,
      classId: data.classId,
      subjectId: data.subjectId,
      title: data.title,
      term: data.term,
      date: new Date(data.date),
      durationMinutes: data.durationMinutes ? Number(data.durationMinutes) : null,
      maxScore: data.maxScore,
    },
  });

  revalidatePath("/directeur/examens");
  revalidatePath("/directeur");
}

export async function deleteExam(examId: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  await prisma.exam.deleteMany({ where: { id: examId, schoolId: user.schoolId } });
  revalidatePath("/directeur/examens");
  revalidatePath("/directeur");
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

  revalidatePath("/directeur/examens");
  revalidatePath("/enseignant/notes");
}
