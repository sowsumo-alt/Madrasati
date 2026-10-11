import { CURRENT_YEAR } from "@/lib/school-year";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/roles";
import { teachesSubject } from "@/lib/subject-ownership";

/**
 * Périmètre d'un enseignant : les classes qu'il a le droit de voir et de
 * modifier. Un enseignant « possède » une classe s'il en est le professeur
 * principal, ou s'il y enseigne au moins une matière.
 *
 * Sert de garde-fou côté serveur : sans cela, un enseignant connecté pourrait
 * envoyer l'identifiant d'une classe qui n'est pas la sienne et saisir l'appel
 * ou les notes d'un collègue.
 */
export async function getTeacherScope(userId: string, schoolId: string) {
  const teacher = await prisma.teacher.findFirst({
    where: { userId, schoolId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!teacher) return null;

  const [mainOf, teaches, currentYearClasses] = await Promise.all([
    prisma.classRoom.findMany({
      where: { schoolId, mainTeacherId: teacher.id },
      select: { id: true },
    }),
    prisma.classSubject.findMany({
      where: { teacherId: teacher.id, classRoom: { schoolId } },
      select: { classId: true },
    }),
    prisma.classRoom.findMany({
      where: { schoolId, ...CURRENT_YEAR },
      select: { id: true },
    }),
  ]);

  const classIds = [
    ...new Set([...mainOf.map((c) => c.id), ...teaches.map((cs) => cs.classId)]),
  ];

  // Deux périmètres volontairement distincts.
  //
  // `classIds` couvre toutes les années : c'est lui qui sert d'autorisation
  // (assertClassAccess), pour qu'un enseignant garde l'accès aux notes et aux
  // appels de l'année écoulée, par exemple depuis un bulletin archivé.
  //
  // `currentClassIds` ne garde que l'année en cours : c'est lui qu'affichent
  // les listes. Sans cette séparation, l'ouverture d'une nouvelle année
  // scolaire faisait apparaître chaque classe en double sous le même nom, et
  // l'enseignant tombait une fois sur deux sur la copie encore vide.
  const currentIds = new Set(currentYearClasses.map((c) => c.id));
  const currentClassIds = classIds.filter((id) => currentIds.has(id));

  return { teacher, classIds, currentClassIds };
}

/**
 * Vérifie qu'un utilisateur a le droit d'agir sur une classe.
 * Le directeur a accès à toute son école ; l'enseignant, seulement à ses classes.
 * Lève une erreur si l'accès est refusé.
 */
export async function assertClassAccess(
  user: { id: string; role: string; schoolId: string },
  classId: string,
) {
  const cls = await prisma.classRoom.findFirst({
    where: { id: classId, schoolId: user.schoolId },
    select: { id: true },
  });
  if (!cls) throw new Error("Classe introuvable.");

  if (user.role === ROLES.DIRECTOR) return;

  if (user.role === ROLES.TEACHER) {
    const scope = await getTeacherScope(user.id, user.schoolId);
    if (scope?.classIds.includes(classId)) return;
  }

  throw new Error("Vous n'avez pas accès à cette classe.");
}

/**
 * Notes d'une matière : le directeur, ou l'enseignant à qui cette matière est
 * confiée dans cette classe. Le professeur principal n'a que les matières
 * confiées à personne (lib/subject-ownership.ts) : ni lui ni le professeur
 * d'arabe d'une 1AS ne modifient les notes de mathématiques d'un collègue.
 */
export async function assertSubjectAccess(
  user: { id: string; role: string; schoolId: string },
  classId: string,
  subjectId: string,
) {
  await assertClassAccess(user, classId);
  if (user.role === ROLES.DIRECTOR) return;

  const [me, classSubject, classRoom] = await Promise.all([
    prisma.teacher.findFirst({ where: { userId: user.id, schoolId: user.schoolId }, select: { id: true } }),
    prisma.classSubject.findFirst({ where: { classId, subjectId }, select: { teacherId: true } }),
    prisma.classRoom.findFirst({ where: { id: classId, schoolId: user.schoolId }, select: { mainTeacherId: true } }),
  ]);
  if (!me || !teachesSubject(me.id, classSubject, classRoom?.mainTeacherId ?? null)) {
    throw new Error("Cette matière est confiée à un collègue : seul son professeur, ou la direction, peut en saisir les notes.");
  }
}

/**
 * Ce qu'un enseignant voit des notes de ses classes : seulement ses matières
 * (et, s'il est professeur principal, celles confiées à personne) — jamais les
 * examens et les notes d'un collègue. Même règle que la saisie
 * (assertSubjectAccess, lib/subject-ownership.ts).
 */
export async function teacherSubjectAccess(teacherId: string, classIds: string[]) {
  const [classes, classSubjects] = await Promise.all([
    prisma.classRoom.findMany({ where: { id: { in: classIds } }, select: { id: true, mainTeacherId: true } }),
    prisma.classSubject.findMany({
      where: { classId: { in: classIds } },
      select: { classId: true, subjectId: true, teacherId: true },
    }),
  ]);
  const mainOf = new Map(classes.map((c) => [c.id, c.mainTeacherId]));
  const allows = (classId: string, subjectId: string) =>
    teachesSubject(
      teacherId,
      classSubjects.find((cs) => cs.classId === classId && cs.subjectId === subjectId),
      mainOf.get(classId) ?? null,
    );
  const own = classSubjects.filter((cs) => allows(cs.classId, cs.subjectId));
  return {
    /** Examens visibles (une liste vide ne laisse rien passer). */
    examWhere: { OR: own.map((cs) => ({ classId: cs.classId, subjectId: cs.subjectId })) },
    allows,
  };
}
