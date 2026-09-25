"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { CURRENT_YEAR } from "@/lib/school-year";
import { examGroupKey } from "@/lib/exam-groups";
import { parseTime } from "@/lib/exams";
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
  /**
   * Examens qui existaient déjà (« 1AS · Mathématiques ») et qui n'ont pas
   * été refaits.
   */
  alreadyPlanned: string[];
}

/** Détails d'un examen, communs à la création et à la modification. */
function examDetails(data: ExamEditValues) {
  return {
    title: data.title,
    kind: data.kind,
    term: data.term,
    date: new Date(data.date),
    startMinutes: parseTime(data.startTime),
    durationMinutes: Number(data.durationMinutes),
    instructions: data.instructions || null,
    maxScore: data.maxScore,
  };
}

/**
 * Planifie un examen pour une ou plusieurs classes, et une ou plusieurs
 * matières, en une seule opération — une composition se crée ainsi pour
 * toutes les matières de toutes les classes d'un coup.
 *
 * Chaque couple classe × matière reçoit son propre examen — ses élèves, ses
 * notes et parfois son enseignant lui sont propres — mais tous partagent
 * titre, date, durée et note maximale. Ceux d'une même matière se
 * retrouvent réunis à l'affichage (voir lib/exam-groups.ts).
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
  const subjectIds = [...new Set(data.subjectIds)];

  const [classes, subjects] = await Promise.all([
    prisma.classRoom.findMany({
      where: { id: { in: classIds }, schoolId: user.schoolId, ...CURRENT_YEAR },
      select: {
        id: true,
        name: true,
        classSubjects: { where: { subjectId: { in: subjectIds } }, select: { subjectId: true } },
      },
    }),
    prisma.subject.findMany({
      where: { id: { in: subjectIds }, schoolId: user.schoolId },
      select: { id: true, name: true },
    }),
  ]);
  if (classes.length !== classIds.length) {
    throw new Error("Une des classes sélectionnées est introuvable.");
  }
  if (subjects.length !== subjectIds.length) {
    throw new Error("Une des matières sélectionnées est introuvable.");
  }

  // Chaque matière doit être enseignée dans chaque classe retenue : sans ce
  // contrôle, l'examen créerait sur le bulletin une ligne pour une matière qui
  // n'est pas au programme de la classe.
  for (const subject of subjects) {
    const withoutSubject = classes.filter(
      (c) => !c.classSubjects.some((cs) => cs.subjectId === subject.id),
    );
    if (withoutSubject.length > 0) {
      throw new Error(
        `${subject.name} n'est pas enseignée en ${withoutSubject.map((c) => c.name).join(", ")}.`,
      );
    }
  }

  const details = examDetails(data);

  // Un examen déjà planifié (même titre, même jour, même matière, même classe)
  // n'est pas recréé : le directeur qui revient sur le formulaire pour ajouter
  // une classe ou une matière oubliée ne doit pas se retrouver avec des doublons.
  const existing = await prisma.exam.findMany({
    where: {
      schoolId: user.schoolId,
      subjectId: { in: subjectIds },
      classId: { in: classIds },
      title: data.title,
      date: details.date,
    },
    select: { classId: true, subjectId: true },
  });
  const exists = (classId: string, subjectId: string) =>
    existing.some((e) => e.classId === classId && e.subjectId === subjectId);

  const pairs = classes.flatMap((c) => subjects.map((s) => ({ classRoom: c, subject: s })));
  const toCreate = pairs.filter((p) => !exists(p.classRoom.id, p.subject.id));
  const skipped = pairs.filter((p) => exists(p.classRoom.id, p.subject.id));

  if (toCreate.length > 0) {
    await prisma.exam.createMany({
      data: toCreate.map((p) => ({
        schoolId: user.schoolId,
        academicYearId: year.id,
        classId: p.classRoom.id,
        subjectId: p.subject.id,
        ...details,
      })),
    });
  }

  revalidatePath("/directeur/examens");
  revalidatePath("/enseignant/notes");
  revalidatePath("/directeur");

  return {
    created: toCreate.length,
    alreadyPlanned: skipped.map((p) =>
      subjects.length > 1 ? `${p.classRoom.name} · ${p.subject.name}` : p.classRoom.name,
    ),
  };
}

/**
 * Examens visés par une action selon sa portée : le seul examen désigné, ou
 * tous ceux du même examen commun (même titre, même jour, même matière).
 */
async function examsInScope(schoolId: string, examId: string, scope: ExamScope) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    select: { id: true, title: true, date: true, subjectId: true, academicYearId: true },
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
    // Borné à l'année scolaire de l'examen : deux compositions homonymes à un
    // an d'intervalle ne forment pas un même examen, et « supprimer pour
    // toutes les classes » ne doit jamais atteindre une année archivée.
    where: {
      schoolId,
      academicYearId: exam.academicYearId,
      subjectId: exam.subjectId,
      date: exam.date,
    },
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
    data: examDetails(data),
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

  // Toutes les notes sont validées avant qu'une seule ne soit écrite.
  // Auparavant la boucle validait et écrivait élève par élève : une note hors
  // barème au dixième rang laissait les neuf premières enregistrées, puis
  // levait une erreur. Le directeur voyait « une erreur est survenue » sans
  // savoir que la moitié de sa saisie était déjà partie en base.
  const writes = [];
  for (const entry of entries) {
    if (!allowedIds.has(entry.studentId)) continue;

    const parsed = entry.score === "" ? null : Number(entry.score);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0 || parsed > exam.maxScore)) {
      throw new Error(`Chaque note doit être comprise entre 0 et ${exam.maxScore}.`);
    }

    const score = entry.isAbsent ? null : parsed;
    writes.push(
      prisma.grade.upsert({
        where: { examId_studentId: { examId, studentId: entry.studentId } },
        create: { examId, studentId: entry.studentId, score, isAbsent: entry.isAbsent },
        update: { score, isAbsent: entry.isAbsent },
      }),
    );
  }

  // Une seule transaction plutôt qu'un aller-retour par élève : la saisie
  // d'une classe de quarante déclenchait quarante allers-retours vers la base,
  // et la base est désormais hébergée loin de la Mauritanie — chaque aller
  // -retour se paie. Soit toute la classe est enregistrée, soit rien.
  if (writes.length > 0) await prisma.$transaction(writes);

  // La moyenne et le compteur « notes saisies » de la page Examens sont
  // recalculés à chaque rendu : revalider suffit à les mettre à jour, sans que
  // personne ait à rafraîchir la page.
  revalidatePath("/directeur/examens");
  revalidatePath("/enseignant/notes");
  revalidatePath("/directeur");
}
