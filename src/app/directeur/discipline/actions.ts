"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { incidentSchema, type IncidentFormValues } from "./schema";

export async function createIncident(values: IncidentFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = incidentSchema.parse(values);

  await prisma.disciplineIncident.create({
    data: {
      schoolId: user.schoolId,
      studentId: data.studentId,
      date: new Date(data.date),
      type: data.type,
      description: data.description,
      sanction: data.sanction || null,
      recordedByUserId: user.id,
    },
  });

  revalidatePath("/directeur/discipline");
  revalidatePath("/directeur");
}

export async function deleteIncident(incidentId: string) {
  const user = await requireRole(ROLES.DIRECTOR);

  await prisma.disciplineIncident.deleteMany({
    where: { id: incidentId, schoolId: user.schoolId },
  });

  revalidatePath("/directeur/discipline");
  revalidatePath("/directeur");
}
