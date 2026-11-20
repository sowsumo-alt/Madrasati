import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SCHOOL_IDENTITY_SELECT, toSchoolIdentity, type SchoolIdentity } from "@/lib/official-header";
import { dueRuleOf, type DueRule } from "@/lib/due-rule";

/**
 * Ce qu'une école change rarement (Paramètres), gardé en cache entre les
 * requêtes au lieu d'être relu dans la base à chaque page : l'en-tête des
 * documents (logo compris) et la règle d'échéance. Une modification des
 * Paramètres efface ce cache (forgetSchool) ; au pire il se renouvelle seul.
 */
const tagOf = (schoolId: string) => `school:${schoolId}`;
const ONE_DAY = 24 * 60 * 60;

/**
 * Nom, coordonnées et logo de l'école, pour l'en-tête des reçus, bulletins et
 * fiches de paie. Le logo est une image encodée de plusieurs dizaines de Ko,
 * relue à chaque reçu imprimé : elle ne transite plus depuis la base qu'une
 * fois par modification.
 */
export function loadSchoolIdentity(schoolId: string): Promise<SchoolIdentity> {
  return unstable_cache(
    async () =>
      toSchoolIdentity(await prisma.school.findUnique({ where: { id: schoolId }, select: SCHOOL_IDENTITY_SELECT })),
    ["school-identity", schoolId],
    { tags: [tagOf(schoolId)], revalidate: ONE_DAY },
  )();
}

/** Jour limite et tolérance de paiement (Paramètres) : lus par la cloche, sur chaque page du directeur. */
export function loadSchoolDueRule(schoolId: string): Promise<DueRule> {
  return unstable_cache(
    async () =>
      dueRuleOf(
        await prisma.school.findUnique({
          where: { id: schoolId },
          select: { paymentDueDay: true, paymentGraceDays: true },
        }),
      ),
    ["school-due-rule", schoolId],
    { tags: [tagOf(schoolId)], revalidate: ONE_DAY },
  )();
}

/** Après une modification des Paramètres de l'école : le cache est relu à la prochaine page. */
export function forgetSchool(schoolId: string) {
  revalidateTag(tagOf(schoolId));
}

const photoTagOf = (studentId: string) => `student-photo:${studentId}`;

/**
 * Photos des élèves affichés (images encodées, ~30 Ko chacune) : en cache,
 * relues dans la base seulement quand la fiche de l'élève change
 * (forgetStudentPhoto). Une liste de 10 élèves pesait 300 Ko à chaque page.
 */
export async function loadStudentPhotos(schoolId: string, studentIds: string[]): Promise<Map<string, string | null>> {
  const ids = [...new Set(studentIds)];
  const photos = await Promise.all(
    ids.map((id) =>
      unstable_cache(
        async () =>
          (await prisma.student.findFirst({ where: { id, schoolId }, select: { photoUrl: true } }))?.photoUrl ?? null,
        ["student-photo", schoolId, id],
        { tags: [photoTagOf(id)], revalidate: 7 * ONE_DAY },
      )(),
    ),
  );
  return new Map(ids.map((id, i) => [id, photos[i]]));
}

/** Après une modification de la fiche d'un élève : sa photo est relue à la prochaine page. */
export function forgetStudentPhoto(studentId: string) {
  revalidateTag(photoTagOf(studentId));
}
