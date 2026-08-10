"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";

const schoolSchema = z.object({
  name: z.string().trim().min(1, "Le nom de l'école est requis"),
  address: z.string().trim().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().optional().or(z.literal("")),
});
export type SchoolFormValues = z.infer<typeof schoolSchema>;

export async function updateSchool(values: SchoolFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = schoolSchema.parse(values);

  await prisma.school.update({
    where: { id: user.schoolId },
    data: {
      name: data.name,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
    },
  });

  revalidatePath("/directeur/parametres");
  revalidatePath("/directeur");
}

const yearSchema = z.object({
  label: z.string().trim().min(1, "Le libellé est requis"),
  startDate: z.string().trim().min(1, "La date de début est requise"),
  endDate: z.string().trim().min(1, "La date de fin est requise"),
});
export type YearFormValues = z.infer<typeof yearSchema>;

export async function createAcademicYear(values: YearFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = yearSchema.parse(values);

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (end <= start) {
    throw new Error("La date de fin doit être après la date de début.");
  }

  await prisma.academicYear.create({
    data: {
      schoolId: user.schoolId,
      label: data.label,
      startDate: start,
      endDate: end,
      isCurrent: false,
    },
  });

  revalidatePath("/directeur/parametres");
}

/** Une seule année peut être active à la fois. */
export async function setCurrentYear(yearId: string) {
  const user = await requireRole(ROLES.DIRECTOR);

  const year = await prisma.academicYear.findFirst({
    where: { id: yearId, schoolId: user.schoolId },
  });
  if (!year) throw new Error("Année scolaire introuvable.");

  await prisma.$transaction([
    prisma.academicYear.updateMany({
      where: { schoolId: user.schoolId },
      data: { isCurrent: false },
    }),
    prisma.academicYear.update({
      where: { id: yearId },
      data: { isCurrent: true },
    }),
  ]);

  revalidatePath("/directeur/parametres");
  revalidatePath("/directeur");
}
