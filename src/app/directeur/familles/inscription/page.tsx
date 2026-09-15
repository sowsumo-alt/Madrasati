import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { CURRENT_YEAR } from "@/lib/school-year";
import { FamilyEnrollmentForm } from "./family-enrollment-form";

/**
 * Inscription groupée d'une famille (plusieurs enfants, un parent saisi une
 * fois). ?famille=<parentId> ouvre directement l'ajout d'enfants à une
 * famille déjà inscrite, depuis sa fiche.
 */
export default async function FamilyEnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<{ famille?: string }>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const { famille } = await searchParams;

  const [classes, parent] = await Promise.all([
    prisma.classRoom.findMany({
      where: { schoolId: user.schoolId, ...CURRENT_YEAR },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    famille
      ? prisma.parent.findFirst({
          where: { id: famille, schoolId: user.schoolId },
          include: {
            studentLinks: {
              include: {
                student: {
                  select: { firstName: true, lastName: true, classRoom: { select: { name: true } } },
                },
              },
            },
          },
        })
      : null,
  ]);

  return (
    <FamilyEnrollmentForm
      classes={classes}
      initialFamily={
        parent
          ? {
              parentId: parent.id,
              familyName: parent.familyName,
              parentFirstName: parent.firstName,
              parentLastName: parent.lastName,
              address: parent.address,
              phone: parent.phone,
              children: parent.studentLinks.map((l) => ({
                name: `${l.student.firstName} ${l.student.lastName}`,
                className: l.student.classRoom?.name ?? null,
              })),
            }
          : null
      }
    />
  );
}
