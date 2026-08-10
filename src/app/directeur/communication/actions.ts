"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";

const templateSchema = z.object({
  title: z.string().trim().min(1, "Le titre est requis"),
  body: z.string().trim().min(1, "Le message est requis"),
});

export type TemplateFormValues = z.infer<typeof templateSchema>;

export async function saveTemplate(templateId: string, values: TemplateFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = templateSchema.parse(values);

  await prisma.messageTemplate.updateMany({
    where: { id: templateId, schoolId: user.schoolId },
    data: { title: data.title, body: data.body },
  });

  revalidatePath("/directeur/communication");
}

export async function createTemplate(values: TemplateFormValues) {
  const user = await requireRole(ROLES.DIRECTOR);
  const data = templateSchema.parse(values);

  await prisma.messageTemplate.create({
    data: {
      schoolId: user.schoolId,
      key: `CUSTOM_${Date.now()}`,
      title: data.title,
      body: data.body,
    },
  });

  revalidatePath("/directeur/communication");
}

export async function deleteTemplate(templateId: string) {
  const user = await requireRole(ROLES.DIRECTOR);
  await prisma.messageTemplate.deleteMany({
    where: { id: templateId, schoolId: user.schoolId },
  });
  revalidatePath("/directeur/communication");
}
