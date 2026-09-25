"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { createStandardClasses } from "@/lib/school-setup";
import { isSchoolType } from "@/lib/school-levels";
import { CURRENT_YEAR } from "@/lib/school-year";
import {
  gradingSchemeFor,
  officialSubjectIndex,
  schoolLevelOf,
  SECONDARY_OFFICIAL_SUBJECTS,
} from "@/lib/grading";
import { classSchema, subjectSchema, type ClassFormValues, type SubjectFormValues } from "./schema";

async function getCurrentAcademicYear(schoolId: string) {
  const year = await prisma.academicYear.findFirst({
    where: { schoolId, isCurrent: true },
  });
  if (!year) throw new Error("Aucune année scolaire active.");
  return year;
}

// Un mainTeacherId d'une autre école ferait fuiter le nom de cet enseignant
// (via les join `mainTeacher` des pages classes/emploi du temps) sans lui
// donner accès à quoi que ce soit — mais reste une fuite de PII à bloquer.
async function assertOwnTeacher(schoolId: string, teacherId: string) {
  const teacher = await prisma.teacher.findFirst({ where: { id: teacherId, schoolId } });
  if (!teacher) throw new Error("Enseignant introuvable.");
}

export async function createClass(values: ClassFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = classSchema.parse(values);
  const year = await getCurrentAcademicYear(user.schoolId);
  if (data.mainTeacherId) await assertOwnTeacher(user.schoolId, data.mainTeacherId);

  await prisma.classRoom.create({
    data: {
      schoolId: user.schoolId,
      academicYearId: year.id,
      name: data.name,
      level: data.level,
      capacity: data.capacity,
      mainTeacherId: data.mainTeacherId || null,
    },
  });

  revalidatePath("/directeur/classes");
  revalidatePath("/directeur");
}

/**
 * Crée d'un coup les classes standard du type d'école choisi, avec leurs
 * matières — le même contenu que reçoit une école qui s'inscrit aujourd'hui.
 * Destiné aux écoles créées avant cet automatisme, ou qui changent de cycle.
 * Les niveaux déjà présents sont conservés tels quels.
 */
export async function generateStandardClasses(schoolType: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  if (!isSchoolType(schoolType)) throw new Error("Type d'école invalide.");
  const year = await getCurrentAcademicYear(user.schoolId);

  const created = await prisma.$transaction((tx) =>
    createStandardClasses(tx, user.schoolId, year.id, schoolType),
  );

  revalidatePath("/directeur/classes");
  revalidatePath("/directeur");
  return { created };
}

export async function updateClass(classId: string, values: ClassFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = classSchema.parse(values);
  if (data.mainTeacherId) await assertOwnTeacher(user.schoolId, data.mainTeacherId);

  await prisma.classRoom.updateMany({
    where: { id: classId, schoolId: user.schoolId },
    data: {
      name: data.name,
      level: data.level,
      capacity: data.capacity,
      mainTeacherId: data.mainTeacherId || null,
    },
  });

  revalidatePath("/directeur/classes");
  revalidatePath("/directeur");
}

export async function deleteClass(classId: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  const cls = await prisma.classRoom.findFirst({
    where: { id: classId, schoolId: user.schoolId },
    include: { _count: { select: { students: true } } },
  });
  if (!cls) throw new Error("Classe introuvable.");
  if (cls._count.students > 0) {
    throw new Error(
      "Impossible de supprimer une classe qui contient encore des élèves.",
    );
  }

  await prisma.classRoom.delete({ where: { id: classId } });
  revalidatePath("/directeur/classes");
  revalidatePath("/directeur");
}

export async function createSubject(values: SubjectFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = subjectSchema.parse(values);

  await prisma.subject.create({
    data: {
      schoolId: user.schoolId,
      name: data.name,
      nameAr: data.nameAr || null,
      coefficient: data.coefficient,
    },
  });

  revalidatePath("/directeur/classes");
}

export async function updateSubject(subjectId: string, values: SubjectFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = subjectSchema.parse(values);

  await prisma.subject.updateMany({
    where: { id: subjectId, schoolId: user.schoolId },
    data: {
      name: data.name,
      nameAr: data.nameAr || null,
      coefficient: data.coefficient,
    },
  });

  revalidatePath("/directeur/classes");
}

/**
 * Supprime une matière qui n'a encore servi à aucun examen. Une matière déjà
 * évaluée porte des notes : la supprimer effacerait ces notes des bulletins,
 * on la désactive donc à la place (voir setSubjectActive).
 */
export async function deleteSubject(subjectId: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, schoolId: user.schoolId },
    include: { _count: { select: { exams: true } } },
  });
  if (!subject) throw new Error("Matière introuvable.");
  if (subject._count.exams > 0) {
    throw new Error("Cette matière a déjà des examens : désactivez-la plutôt.");
  }

  await prisma.subject.delete({ where: { id: subjectId } });
  revalidatePath("/directeur/classes");
}

export async function setSubjectActive(subjectId: string, isActive: boolean) {
  const user = await requireRole(ROLES.DIRECTOR);
  await prisma.subject.updateMany({
    where: { id: subjectId, schoolId: user.schoolId },
    data: { isActive },
  });
  revalidatePath("/directeur/classes");
}

export async function assignSubjectToClass(
  classId: string,
  subjectId: string,
  teacherId: string | null,
) {
  const user = await requireRole(ROLES.DIRECTOR);

  const cls = await prisma.classRoom.findFirst({
    where: { id: classId, schoolId: user.schoolId },
  });
  if (!cls) throw new Error("Classe introuvable.");

  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, schoolId: user.schoolId },
  });
  if (!subject) throw new Error("Matière introuvable.");

  if (teacherId) await assertOwnTeacher(user.schoolId, teacherId);

  await prisma.classSubject.upsert({
    where: { classId_subjectId: { classId, subjectId } },
    create: { classId, subjectId, teacherId },
    update: { teacherId },
  });

  revalidatePath("/directeur/classes");
}

export async function removeSubjectFromClass(classId: string, subjectId: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  const cls = await prisma.classRoom.findFirst({
    where: { id: classId, schoolId: user.schoolId },
  });
  if (!cls) throw new Error("Classe introuvable.");

  await prisma.classSubject.deleteMany({ where: { classId, subjectId } });
  revalidatePath("/directeur/classes");
}

/**
 * Coefficient d'une matière dans une classe. Vide (null) : la classe suit le
 * coefficient de la matière pour toute l'école.
 */
export async function setClassSubjectCoefficient(
  classId: string,
  subjectId: string,
  coefficient: number | null,
) {
  const user = await requireRole(ROLES.DIRECTOR);
  if (coefficient != null && (!Number.isInteger(coefficient) || coefficient < 1 || coefficient > 20)) {
    throw new Error("Le coefficient doit être un nombre entier entre 1 et 20.");
  }

  const link = await prisma.classSubject.findFirst({
    where: { classId, subjectId, classRoom: { schoolId: user.schoolId } },
    select: { id: true, subject: { select: { coefficient: true } } },
  });
  if (!link) throw new Error("Cette matière n'est pas rattachée à cette classe.");

  await prisma.classSubject.update({
    where: { id: link.id },
    data: {
      coefficientOverride:
        coefficient == null || coefficient === link.subject.coefficient ? null : coefficient,
    },
  });

  revalidatePath("/directeur/classes");
  revalidatePath("/directeur/bulletins");
}

/**
 * Applique aux classes du collège et du lycée de l'année les neuf matières du
 * bulletin officiel et leurs coefficients (total 24) : Arabe 5, Français 4,
 * Anglais 1, Mathématiques 5, Sciences Naturelles 2, Histoire-Géographie 2,
 * Instruction Religieuse 3, Instruction Civique 1, Éducation Physique 1.
 *
 * Une matière que l'école a déjà, sous ce nom ou un autre (« Études
 * Islamiques » pour l'Instruction Religieuse…), est réutilisée ; seule une
 * matière absente est créée. Les classes du Fondamental ne sont pas touchées,
 * ni les autres matières des classes AS, ni leurs enseignants.
 */
export async function applyOfficialSecondaryCoefficients(classIds?: string[]) {
  const user = await requireRole(ROLES.DIRECTOR);

  const [classes, subjects] = await Promise.all([
    prisma.classRoom.findMany({
      where: { schoolId: user.schoolId, ...CURRENT_YEAR },
      select: { id: true, name: true, level: true },
    }),
    prisma.subject.findMany({
      where: { schoolId: user.schoolId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isActive: true },
    }),
  ]);
  // Les coefficients changent d'un niveau à l'autre (les maths comptent 5 en
  // 1°AS, 8 en 7°C) : le directeur choisit les classes qui suivent ce modèle.
  const secondary = classes.filter(
    (c) =>
      gradingSchemeFor(schoolLevelOf(c.level, c.name)) === "SECONDARY" &&
      (!classIds || classIds.includes(c.id)),
  );
  if (secondary.length === 0) throw new Error("Choisissez au moins une classe du collège ou du lycée.");

  const created: string[] = [];
  await prisma.$transaction(
    async (tx) => {
      for (const [index, official] of SECONDARY_OFFICIAL_SUBJECTS.entries()) {
        let subject = subjects.find((s) => officialSubjectIndex(s.name) === index);
        if (!subject) {
          subject = await tx.subject.create({
            data: {
              schoolId: user.schoolId,
              name: official.name,
              nameAr: official.nameAr,
              coefficient: official.coefficient,
            },
            select: { id: true, name: true, isActive: true },
          });
          created.push(official.name);
        } else if (!subject.isActive) {
          await tx.subject.update({ where: { id: subject.id }, data: { isActive: true } });
        }

        for (const c of secondary) {
          await tx.classSubject.upsert({
            where: { classId_subjectId: { classId: c.id, subjectId: subject.id } },
            create: { classId: c.id, subjectId: subject.id, coefficientOverride: official.coefficient },
            update: { coefficientOverride: official.coefficient },
          });
        }
      }
    },
    { timeout: 30_000 },
  );

  revalidatePath("/directeur/classes");
  revalidatePath("/directeur/bulletins");
  revalidatePath("/directeur/notes");
  return { classes: secondary.length, created };
}

/**
 * Applique à une classe la configuration d'une autre : mêmes matières, mêmes
 * coefficients. Pratique pour une deuxième section du même niveau (« 7°C 2 »
 * d'après « 7°C 1 ») : chaque niveau a ses matières et ses coefficients, et
 * le directeur ne les ressaisit pas.
 *
 * Les enseignants déjà désignés dans la classe cible restent en place. Une
 * matière absente du modèle est retirée de la classe, sauf si des examens y
 * ont déjà été passés : ses notes resteraient sans bulletin, on la garde.
 */
export async function copyClassSubjects(targetClassId: string, sourceClassId: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  if (targetClassId === sourceClassId) throw new Error("Choisissez une autre classe.");

  const [target, source] = await Promise.all([
    prisma.classRoom.findFirst({
      where: { id: targetClassId, schoolId: user.schoolId },
      select: {
        id: true,
        classSubjects: { select: { subjectId: true } },
        exams: { select: { subjectId: true }, distinct: ["subjectId"] },
      },
    }),
    prisma.classRoom.findFirst({
      where: { id: sourceClassId, schoolId: user.schoolId },
      select: {
        classSubjects: {
          select: { subjectId: true, coefficientOverride: true, subject: { select: { coefficient: true } } },
        },
      },
    }),
  ]);
  if (!target || !source) throw new Error("Classe introuvable.");

  const sourceIds = new Set(source.classSubjects.map((cs) => cs.subjectId));
  const graded = new Set(target.exams.map((e) => e.subjectId));
  const toRemove = target.classSubjects
    .map((cs) => cs.subjectId)
    .filter((id) => !sourceIds.has(id) && !graded.has(id));
  const kept = target.classSubjects.filter(
    (cs) => !sourceIds.has(cs.subjectId) && graded.has(cs.subjectId),
  ).length;

  await prisma.$transaction([
    ...source.classSubjects.map((cs) =>
      prisma.classSubject.upsert({
        where: { classId_subjectId: { classId: target.id, subjectId: cs.subjectId } },
        create: {
          classId: target.id,
          subjectId: cs.subjectId,
          coefficientOverride: cs.coefficientOverride,
        },
        update: { coefficientOverride: cs.coefficientOverride },
      }),
    ),
    prisma.classSubject.deleteMany({ where: { classId: target.id, subjectId: { in: toRemove } } }),
  ]);

  revalidatePath("/directeur/classes");
  revalidatePath("/directeur/bulletins");
  return { copied: source.classSubjects.length, removed: toRemove.length, kept };
}
