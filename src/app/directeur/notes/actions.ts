"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { assertClassAccess, getTeacherScope } from "@/lib/teacher-scope";
import { gradingSchemeFor, isCompositionExam, schoolLevelOf } from "@/lib/grading";
import { isNewDevoirColumn, NEW_COMPOSITION, parseCell } from "@/lib/grade-sheet";
import { TERMS } from "@/app/directeur/examens/schema";

const sheetSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  term: z.enum(TERMS),
  /** Devoirs ajoutés dans la grille, dans l'ordre de leurs colonnes. */
  newDevoirs: z.array(z.string().refine(isNewDevoirColumn)).max(20),
  cells: z
    .array(
      z.object({
        column: z.string().min(1),
        studentId: z.string().min(1),
        value: z.string().max(20),
      }),
    )
    .max(5000),
});
export type GradeSheetInput = z.infer<typeof sheetSchema>;

/** Minuit UTC du jour : la date des devoirs et compositions créés depuis la grille. */
function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Enregistre la grille d'une matière pour un trimestre, au collège et au
 * lycée : les devoirs ajoutés et la composition sont créés à ce moment-là —
 * comme des examens ordinaires, de type Devoir ou Composition —, puis toutes
 * les notes sont écrites en une seule transaction. Soit tout passe, soit rien.
 *
 * Chaque note est gardée brute, telle qu'obtenue ; le meilleur devoir n'est
 * choisi qu'au calcul de la moyenne (lib/grading.ts).
 */
export async function saveGradeSheet(input: GradeSheetInput) {
  const user = await requireRole(ROLES.DIRECTOR, ROLES.TEACHER);
  const data = sheetSchema.parse(input);

  await assertClassAccess(user, data.classId);

  const classRoom = await prisma.classRoom.findFirst({
    where: { id: data.classId, schoolId: user.schoolId },
    select: {
      id: true,
      name: true,
      level: true,
      academicYearId: true,
      mainTeacherId: true,
      classSubjects: { where: { subjectId: data.subjectId }, select: { teacherId: true } },
    },
  });
  if (!classRoom) throw new Error("Classe introuvable.");
  const classSubject = classRoom.classSubjects[0];
  if (!classSubject) throw new Error("Cette matière n'est pas enseignée dans cette classe.");

  // La grille Devoirs / Composition est celle du collège et du lycée. Le
  // Fondamental garde sa saisie par examen et son calcul d'origine.
  if (gradingSchemeFor(schoolLevelOf(classRoom.level, classRoom.name)) !== "SECONDARY") {
    throw new Error("Cette grille est réservée aux classes du collège et du lycée.");
  }

  const [exams, students] = await Promise.all([
    prisma.exam.findMany({
      where: {
        schoolId: user.schoolId,
        classId: data.classId,
        subjectId: data.subjectId,
        term: data.term,
      },
      select: { id: true, title: true, kind: true, date: true, maxScore: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.student.findMany({
      where: { schoolId: user.schoolId, classId: data.classId },
      select: { id: true },
    }),
  ]);
  const allowedStudents = new Set(students.map((s) => s.id));
  const examById = new Map(exams.map((e) => [e.id, e]));
  const devoirCount = exams.filter((e) => !isCompositionExam(e)).length;
  const hasComposition = exams.some((e) => isCompositionExam(e));

  // Toutes les cases sont lues et vérifiées avant la moindre écriture.
  const byColumn = new Map<string, { studentId: string; score: number | null; isAbsent: boolean }[]>();
  for (const cell of data.cells) {
    if (!allowedStudents.has(cell.studentId)) continue;
    const exam = examById.get(cell.column);
    const isNew = isNewDevoirColumn(cell.column) || cell.column === NEW_COMPOSITION;
    if (!exam && !isNew) throw new Error("Une colonne de la grille n'existe plus. Rechargez la page.");
    if (isNewDevoirColumn(cell.column) && !data.newDevoirs.includes(cell.column)) {
      throw new Error("Une colonne de la grille n'existe plus. Rechargez la page.");
    }

    const maxScore = exam?.maxScore ?? 20;
    const parsed = parseCell(cell.value, maxScore);
    if (parsed.invalid) throw new Error(`Chaque note doit être comprise entre 0 et ${maxScore}.`);

    const list = byColumn.get(cell.column) ?? [];
    list.push({ studentId: cell.studentId, score: parsed.score, isAbsent: parsed.isAbsent });
    byColumn.set(cell.column, list);
  }

  const creatingExams =
    data.newDevoirs.some((c) => byColumn.has(c)) || (byColumn.has(NEW_COMPOSITION) && !hasComposition);

  // Un enseignant saisit les notes de toutes ses classes, comme sur la page
  // Examens ; mais il n'ouvre un nouveau devoir que dans une matière qu'il
  // enseigne, ou dans la classe dont il est le professeur principal.
  if (creatingExams && user.role === ROLES.TEACHER) {
    const scope = await getTeacherScope(user.id, user.schoolId);
    const teacherId = scope?.teacher.id;
    if (!teacherId || (classSubject.teacherId !== teacherId && classRoom.mainTeacherId !== teacherId)) {
      throw new Error("Seul l'enseignant de cette matière peut ajouter un devoir.");
    }
  }

  const common = {
    schoolId: user.schoolId,
    academicYearId: classRoom.academicYearId,
    classId: classRoom.id,
    subjectId: data.subjectId,
    term: data.term,
    date: today(),
    maxScore: 20,
  };
  const toGrades = (list: { studentId: string; score: number | null; isAbsent: boolean }[]) =>
    list.map((g) => ({ studentId: g.studentId, score: g.isAbsent ? null : g.score, isAbsent: g.isAbsent }));

  const writes = [];

  // Les devoirs ajoutés prennent la suite des devoirs existants : Devoir 3
  // après Devoir 1 et Devoir 2. Une colonne ajoutée puis laissée vide n'est
  // pas créée.
  let number = devoirCount;
  for (const column of data.newDevoirs) {
    const list = byColumn.get(column);
    if (!list || list.length === 0) continue;
    number += 1;
    writes.push(
      prisma.exam.create({
        data: {
          ...common,
          title: `Devoir ${number}`,
          kind: "DEVOIR",
          grades: { create: toGrades(list) },
        },
      }),
    );
  }

  // Une seule composition par trimestre : si elle existe déjà, ses notes y
  // vont plutôt que dans une deuxième.
  const compositionCells = byColumn.get(NEW_COMPOSITION);
  const existingComposition = [...exams].reverse().find((e) => isCompositionExam(e));
  if (compositionCells && compositionCells.length > 0 && !existingComposition) {
    writes.push(
      prisma.exam.create({
        data: {
          ...common,
          title: `Composition ${data.term}`,
          kind: "COMPOSITION",
          grades: { create: toGrades(compositionCells) },
        },
      }),
    );
  }

  for (const [column, list] of byColumn) {
    const examId =
      column === NEW_COMPOSITION ? existingComposition?.id : examById.get(column)?.id;
    if (!examId) continue;
    for (const g of toGrades(list)) {
      writes.push(
        prisma.grade.upsert({
          where: { examId_studentId: { examId, studentId: g.studentId } },
          create: { examId, ...g },
          update: { score: g.score, isAbsent: g.isAbsent },
        }),
      );
    }
  }

  if (writes.length > 0) await prisma.$transaction(writes);

  revalidatePath("/directeur/notes");
  revalidatePath("/enseignant/saisie-notes");
  revalidatePath("/directeur/examens");
  revalidatePath("/enseignant/notes");
  revalidatePath("/directeur/bulletins");
  revalidatePath("/directeur");
}
