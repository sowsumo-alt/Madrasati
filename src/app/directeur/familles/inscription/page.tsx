import { requireRole } from "@/lib/session";
import { classOptions } from "@/lib/class-catalog";
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

  const [classes, parent, school] = await Promise.all([
    prisma.classRoom.findMany({
      where: { schoolId: user.schoolId, ...CURRENT_YEAR },
      select: { id: true, name: true, level: true, category: true },
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
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { monthlyTuition: true } }),
  ]);

  return (
    <FamilyEnrollmentForm
      classes={classOptions(classes)}
      schoolMonthly={school?.monthlyTuition ?? null}
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
