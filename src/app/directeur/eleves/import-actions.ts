"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { CURRENT_YEAR } from "@/lib/school-year";
import { assertNnisAvailable } from "@/lib/nni-data";
import { isValidNni, normalizeNni } from "@/lib/nni";
import { createClassWithSubjects } from "@/lib/class-setup";
import { UserError, asResult } from "@/lib/user-error";

/**
 * Import d'une liste d'élèves lue dans un fichier Excel (voir
 * lib/student-import.ts et import-dialog.tsx). Le directeur a déjà vu et
 * corrigé la liste avant d'arriver ici : tout le fichier entre, ou rien.
 */

const studentSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  placeOfBirth: z.string().trim().max(80).nullable(),
  gender: z.enum(["M", "F"]).nullable(),
  nni: z
    .string()
    .nullable()
    .refine((v) => v == null || isValidNni(v), "NNI invalide"),
  rimNumber: z.string().trim().max(30).nullable(),
  nationality: z.string().trim().max(40).nullable(),
  phone: z.string().trim().max(20).nullable(),
  className: z.string().trim().max(60).nullable(),
});

const targetSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), classId: z.string().min(1) }),
  z.object({
    mode: z.literal("new"),
    category: z.string().trim().min(1, "Choisissez une catégorie"),
    level: z.string().trim().min(1, "Choisissez un niveau"),
    section: z.string().trim().max(20).optional(),
  }),
  z.object({ mode: z.literal("none") }),
]);

const importSchema = z.object({
  students: z.array(studentSchema).min(1, "Aucun élève à importer.").max(1000),
  target: targetSchema,
});
export type StudentImportInput = z.infer<typeof importSchema>;

/** 8 chiffres mauritaniens → « 222XXXXXXXX », comme les formulaires. */
function storedPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  return d.length === 8 ? `222${d}` : d;
}
const lastEight = (phone: string) => phone.replace(/\D/g, "").slice(-8);
const sameName = (a: string, b: string) =>
  a.normalize("NFC").trim().toLowerCase() === b.normalize("NFC").trim().toLowerCase();

/**
 * NNI du fichier déjà portés par un élève de l'école : l'élève est sans doute
 * déjà inscrit. Renvoyé à l'aperçu pour être signalé avant l'import.
 */
export async function takenNnis(nnis: string[]): Promise<Record<string, string>> {
  const user = await requireRole(ROLES.DIRECTOR);
  const wanted = nnis.filter(isValidNni).map(normalizeNni);
  if (wanted.length === 0) return {};
  const found = await prisma.student.findMany({
    where: { schoolId: user.schoolId, nni: { in: wanted } },
    select: { nni: true, firstName: true, lastName: true },
  });
  return Object.fromEntries(found.map((s) => [s.nni!, `${s.firstName} ${s.lastName}`]));
}

/** L'erreur est renvoyée, pas levée : en ligne, le directeur la lit (voir lib/user-error.ts). */
export async function importStudentList(input: StudentImportInput) {
  return asResult(() => importStudentListUnsafe(input));
}

async function importStudentListUnsafe(input: StudentImportInput) {
  const user = await requireRole(ROLES.DIRECTOR);
  const { students, target } = importSchema.parse(input);
  const schoolId = user.schoolId;

  await assertNnisAvailable(schoolId, students.map((s) => s.nni)).catch((e: unknown) => {
    throw new UserError(e instanceof Error ? e.message : "NNI déjà utilisé.");
  });

  const year = await prisma.academicYear.findFirst({
    where: { schoolId, isCurrent: true },
    select: { id: true },
  });
  if (!year) throw new UserError("Aucune année scolaire active.");

  const [classes, parents] = await Promise.all([
    prisma.classRoom.findMany({
      where: { schoolId, ...CURRENT_YEAR },
      select: { id: true, name: true },
    }),
    prisma.parent.findMany({ where: { schoolId }, select: { id: true, phone: true } }),
  ]);

  if (target.mode === "existing" && !classes.some((c) => c.id === target.classId)) {
    throw new UserError("Classe introuvable.");
  }

  return prisma.$transaction(
    async (tx) => {
      let defaultClass: { id: string; name: string } | null = null;
      if (target.mode === "existing") {
        defaultClass = classes.find((c) => c.id === target.classId) ?? null;
      } else if (target.mode === "new") {
        const created = await createClassWithSubjects(tx, {
          schoolId,
          academicYearId: year.id,
          category: target.category,
          level: target.level,
          section: target.section,
        });
        defaultClass = { id: created.id, name: created.name };
      }

      const parentByPhone = new Map(parents.map((p) => [lastEight(p.phone), p.id]));
      let parentsCreated = 0;
      let parentsLinked = 0;

      for (const s of students) {
        // Une colonne « Classe » dans le fichier l'emporte ; sinon la classe
        // choisie pour tout le fichier.
        const own = s.className ? classes.find((c) => sameName(c.name, s.className!)) : null;
        const student = await tx.student.create({
          data: {
            schoolId,
            firstName: s.firstName,
            lastName: s.lastName,
            dateOfBirth: s.dateOfBirth ? new Date(`${s.dateOfBirth}T00:00:00Z`) : null,
            placeOfBirth: s.placeOfBirth,
            gender: s.gender,
            nni: s.nni ? normalizeNni(s.nni) : null,
            rimNumber: s.rimNumber,
            nationality: s.nationality,
            classId: own?.id ?? defaultClass?.id ?? null,
            status: "ACTIVE",
          },
          select: { id: true },
        });

        // Le téléphone du fichier est celui du parent : un numéro déjà connu
        // rattache l'élève à sa famille (frères et sœurs compris) ; sinon un
        // parent est créé, à compléter plus tard depuis la fiche Famille.
        if (s.phone && s.phone.replace(/\D/g, "").length >= 8) {
          const key = lastEight(s.phone);
          let parentId = parentByPhone.get(key);
          if (parentId) {
            parentsLinked++;
          } else {
            parentId = (
              await tx.parent.create({
                data: {
                  schoolId,
                  firstName: "Parent",
                  lastName: s.lastName,
                  phone: storedPhone(s.phone),
                },
                select: { id: true },
              })
            ).id;
            parentByPhone.set(key, parentId);
            parentsCreated++;
          }
          await tx.studentParent.create({
            data: { studentId: student.id, parentId, isPrimary: true },
          });
        }
      }

      return {
        created: students.length,
        className: defaultClass?.name ?? null,
        classCreated: target.mode === "new",
        parentsCreated,
        parentsLinked,
      };
    },
    { timeout: 60_000 },
  ).finally(() => {
    revalidatePath("/directeur/eleves");
    revalidatePath("/directeur/classes");
    revalidatePath("/directeur/parents");
    revalidatePath("/directeur");
  });
}
