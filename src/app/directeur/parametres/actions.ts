"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { isPlan } from "@/lib/plans";

/** Data URI d'image, plafonné pour éviter de gonfler la base. */
const LOGO_MAX_CHARS = 400_000; // ~300 Ko une fois décodé

const schoolSchema = z.object({
  name: z.string().trim().min(1, "Le nom de l'école est requis"),
  address: z.string().trim().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().optional().or(z.literal("")),
  logoUrl: z
    .string()
    .max(LOGO_MAX_CHARS, "Image trop lourde")
    .nullable()
    .optional(),
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
      logoUrl: data.logoUrl || null,
    },
  });

  revalidatePath("/directeur/parametres");
  revalidatePath("/directeur");
}

/**
 * Enregistre une demande de mise à niveau — ne change jamais School.plan
 * elle-même : c'est un journal consultable, l'activation reste manuelle
 * (l'éditeur valide le paiement avant d'activer la formule).
 */
export async function requestPlanUpgrade(requestedPlan: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  if (!isPlan(requestedPlan)) throw new Error("Formule invalide.");

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { plan: true },
  });

  await prisma.planUpgradeRequest.create({
    data: {
      schoolId: user.schoolId,
      currentPlan: school?.plan ?? "standard",
      requestedPlan,
      requestedByUserId: user.id,
    },
  });

  revalidatePath("/directeur/parametres");
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
