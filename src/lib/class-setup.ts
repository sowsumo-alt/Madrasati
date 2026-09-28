import type { Prisma } from "@prisma/client";
import { isStandardCategory, nextClassName, type StandardCategory } from "@/lib/class-catalog";
import { UserError } from "@/lib/user-error";
import { officialSubjectIndex, SECONDARY_OFFICIAL_SUBJECTS } from "@/lib/grading";
import { subjectNamesForCycle } from "@/lib/school-levels";

/**
 * Création d'une classe avec ses matières, depuis la page Classes ou depuis
 * l'import d'une liste d'élèves.
 *
 * Une classe naît prête à noter : elle reçoit tout de suite ses matières et
 * leurs coefficients, que le directeur ajuste ensuite classe par classe.
 * - Deuxième section d'un niveau (« 1AF B ») : elle reprend les matières et
 *   coefficients de la classe du même niveau déjà créée cette année — les
 *   sections d'un niveau restent identiques sans rien ressaisir.
 * - Sinon, le modèle de sa catégorie : au Fondamental les matières du
 *   primaire, au Collège et au Lycée les neuf matières du bulletin officiel
 *   et leurs coefficients. Le Préscolaire et les catégories propres à
 *   l'école partent sans matière.
 */

export interface NewClassInput {
  schoolId: string;
  academicYearId: string;
  category: string;
  level: string;
  section?: string | null;
  capacity?: number;
  mainTeacherId?: string | null;
}

export type SubjectsSource = "copied" | "template" | "none";

const sameText = (a: string, b: string) =>
  a.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase() ===
  b.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();

const CYCLE_OF: Partial<Record<StandardCategory, "primaire" | "college" | "lycee">> = {
  FONDAMENTAL: "primaire",
  COLLEGE: "college",
  LYCEE: "lycee",
};

export async function createClassWithSubjects(
  tx: Prisma.TransactionClient,
  input: NewClassInput,
): Promise<{ id: string; name: string; subjectsFrom: SubjectsSource }> {
  const sameYear = await tx.classRoom.findMany({
    where: { schoolId: input.schoolId, academicYearId: input.academicYearId },
    select: {
      name: true,
      level: true,
      classSubjects: { select: { subjectId: true, coefficientOverride: true } },
    },
  });
  // Sans section saisie, une classe d'un niveau déjà présent prend la
  // lettre suivante (« 1AF » existe → « 1AF B ») plutôt que d'être refusée.
  const name = nextClassName(input.level, input.section, sameYear.map((c) => c.name));
  if (sameYear.some((c) => sameText(c.name, name))) {
    throw new UserError(`La classe « ${name} » existe déjà cette année. Choisissez une autre section.`);
  }

  const created = await tx.classRoom.create({
    data: {
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      name,
      level: input.level.trim(),
      category: input.category.trim(),
      capacity: input.capacity ?? 30,
      mainTeacherId: input.mainTeacherId || null,
    },
    select: { id: true },
  });

  const sibling = sameYear.find(
    (c) => sameText(c.level, input.level) && c.classSubjects.length > 0,
  );
  if (sibling) {
    await tx.classSubject.createMany({
      data: sibling.classSubjects.map((cs) => ({ ...cs, classId: created.id })),
      skipDuplicates: true,
    });
    return { id: created.id, name, subjectsFrom: "copied" };
  }

  const linked = await attachCategoryTemplate(tx, input.schoolId, created.id, input.category);
  return { id: created.id, name, subjectsFrom: linked > 0 ? "template" : "none" };
}

async function attachCategoryTemplate(
  tx: Prisma.TransactionClient,
  schoolId: string,
  classId: string,
  category: string,
): Promise<number> {
  if (!isStandardCategory(category)) return 0;
  const cycle = CYCLE_OF[category];
  if (!cycle) return 0;

  const subjects = await tx.subject.findMany({
    where: { schoolId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, isActive: true },
  });

  if (cycle === "primaire") {
    const ids = subjectNamesForCycle(cycle)
      .map((wanted) => subjects.find((s) => s.isActive && sameText(s.name, wanted))?.id)
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) return 0;
    await tx.classSubject.createMany({
      data: ids.map((subjectId) => ({ classId, subjectId })),
      skipDuplicates: true,
    });
    return ids.length;
  }

  // Collège et lycée : les matières du bulletin officiel, créées si l'école
  // ne les a pas encore (sous ce nom ou un autre, voir officialSubjectIndex).
  const links: { classId: string; subjectId: string; coefficientOverride: number }[] = [];
  for (const [index, official] of SECONDARY_OFFICIAL_SUBJECTS.entries()) {
    let subject = subjects.find((s) => officialSubjectIndex(s.name) === index);
    if (!subject) {
      subject = await tx.subject.create({
        data: {
          schoolId,
          name: official.name,
          nameAr: official.nameAr,
          coefficient: official.coefficient,
        },
        select: { id: true, name: true, isActive: true },
      });
      subjects.push(subject);
    } else if (!subject.isActive) {
      await tx.subject.update({ where: { id: subject.id }, data: { isActive: true } });
    }
    links.push({ classId, subjectId: subject.id, coefficientOverride: official.coefficient });
  }
  await tx.classSubject.createMany({ data: links, skipDuplicates: true });
  return links.length;
}
