"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { assertClassAccess, getTeacherScope } from "@/lib/teacher-scope";
import { schoolLevelOf } from "@/lib/grading";
import { partForKind, type FormulaPart } from "@/lib/grading-config";
import { currentGradingConfig } from "@/lib/grading-config-data";
import { examKindOf, formulaFor } from "@/lib/report-card-compute";
import { isNewColumn, newColumnPart, parseCell } from "@/lib/grade-sheet";
import { TERMS } from "@/app/directeur/examens/schema";

const sheetSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
  term: z.enum(TERMS),
  /** Colonnes ajoutées dans la grille, dans l'ordre où elles s'affichent. */
  newColumns: z.array(z.string().refine(isNewColumn)).max(40),
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

/** Minuit UTC du jour : la date des notes créées depuis la grille. */
function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Enregistre la grille d'une matière pour un trimestre : les colonnes
 * ajoutées deviennent des examens ordinaires — du type prévu par le bloc de
 * la formule auquel elles appartiennent —, puis toutes les notes sont
 * écrites en une seule transaction. Soit tout passe, soit rien.
 *
 * Chaque note est gardée brute, telle qu'obtenue ; la règle de l'école
 * (meilleure note, moyenne, somme…) ne s'applique qu'au calcul de la
 * moyenne, jamais à l'enregistrement.
 */
export async function saveGradeSheet(input: GradeSheetInput) {
  const user = await requireRole(ROLES.DIRECTOR, ROLES.TEACHER);
  const data = sheetSchema.parse(input);

  await assertClassAccess(user, data.classId);

  const [classRoom, rule] = await Promise.all([
    prisma.classRoom.findFirst({
      where: { id: data.classId, schoolId: user.schoolId },
      select: {
        id: true,
        name: true,
        level: true,
        academicYearId: true,
        mainTeacherId: true,
        classSubjects: { where: { subjectId: data.subjectId }, select: { teacherId: true } },
      },
    }),
    currentGradingConfig(user.schoolId),
  ]);
  if (!classRoom) throw new Error("Classe introuvable.");
  const classSubject = classRoom.classSubjects[0];
  if (!classSubject) throw new Error("Cette matière n'est pas enseignée dans cette classe.");

  const formula = formulaFor(rule.config, schoolLevelOf(classRoom.level, classRoom.name));
  const partById = new Map(formula.parts.map((p) => [p.id, p]));

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

  // Toutes les cases sont lues et vérifiées avant la moindre écriture.
  const byColumn = new Map<string, { studentId: string; score: number | null; isAbsent: boolean }[]>();
  for (const cell of data.cells) {
    if (!allowedStudents.has(cell.studentId)) continue;
    const exam = examById.get(cell.column);
    if (!exam && !(isNewColumn(cell.column) && data.newColumns.includes(cell.column))) {
      throw new Error("Une colonne de la grille n'existe plus. Rechargez la page.");
    }

    const maxScore = exam?.maxScore ?? 20;
    const parsed = parseCell(cell.value, maxScore);
    if (parsed.invalid) throw new Error(`Chaque note doit être comprise entre 0 et ${maxScore}.`);

    const list = byColumn.get(cell.column) ?? [];
    list.push({ studentId: cell.studentId, score: parsed.score, isAbsent: parsed.isAbsent });
    byColumn.set(cell.column, list);
  }

  const creating = data.newColumns.some((c) => byColumn.has(c));

  // Un enseignant saisit les notes de toutes ses classes, comme sur la page
  // Examens ; mais il n'ouvre une nouvelle note que dans une matière qu'il
  // enseigne, ou dans la classe dont il est le professeur principal.
  if (creating && user.role === ROLES.TEACHER) {
    const scope = await getTeacherScope(user.id, user.schoolId);
    const teacherId = scope?.teacher.id;
    if (!teacherId || (classSubject.teacherId !== teacherId && classRoom.mainTeacherId !== teacherId)) {
      throw new Error("Seul l'enseignant de cette matière peut ajouter une note.");
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

  /** Nombre de notes déjà enregistrées dans ce bloc : « Devoir 3 » suit « Devoir 2 ». */
  const countOf = (part: FormulaPart) =>
    exams.filter((e) => partForKind(formula, examKindOf(e))?.id === part.id).length;
  const created = new Map<string, number>();

  const writes = [];

  for (const column of data.newColumns) {
    const list = byColumn.get(column);
    if (!list || list.length === 0) continue;
    const part = partById.get(newColumnPart(column) ?? "");
    if (!part) throw new Error("Cette colonne ne correspond à aucun type de note de votre règle.");

    const rank = countOf(part) + (created.get(part.id) ?? 0) + 1;
    created.set(part.id, (created.get(part.id) ?? 0) + 1);
    const name = part.examTitle ?? part.label;
    writes.push(
      prisma.exam.create({
        data: {
          ...common,
          // Une note seule dans son bloc porte le nom du trimestre
          // (« Composition Trimestre 1 ») ; au-delà, elle est numérotée.
          title: rank === 1 && part.multiple === "LAST" ? `${name} ${data.term}` : `${name} ${rank}`,
          kind: part.kinds[0] ?? "DEVOIR",
          grades: { create: toGrades(list) },
        },
      }),
    );
  }

  for (const [column, list] of byColumn) {
    const examId = examById.get(column)?.id;
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
