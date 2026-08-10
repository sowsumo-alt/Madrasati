import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/roles";

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

  const [mainOf, teaches] = await Promise.all([
    prisma.classRoom.findMany({
      where: { schoolId, mainTeacherId: teacher.id },
      select: { id: true },
    }),
    prisma.classSubject.findMany({
      where: { teacherId: teacher.id, classRoom: { schoolId } },
      select: { classId: true },
    }),
  ]);

  const classIds = [
    ...new Set([...mainOf.map((c) => c.id), ...teaches.map((cs) => cs.classId)]),
  ];

  return { teacher, classIds };
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
