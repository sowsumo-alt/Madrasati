import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { familyBalance, familyLabel } from "@/lib/family";
import { FamiliesView, type FamilyListRow } from "./families-view";

/**
 * Vue « Familles » : chaque famille une fois, avec son nombre d'élèves, ce
 * qu'elle a versé et ce qu'elle doit à ce jour — la même règle de calcul que
 * la fiche famille, le tableau de bord et les impayés (lib/money.ts).
 */
export default async function FamiliesPage() {
  const user = await requireRole(ROLES.DIRECTOR);
  const parents = await prisma.parent.findMany({
    where: { schoolId: user.schoolId, studentLinks: { some: {} } },
    include: {
      studentLinks: {
        include: {
          student: {
            select: {
              status: true,
              fees: { select: { amount: true, dueDate: true, payments: { select: { amount: true } } } },
            },
          },
        },
      },
    },
  });

  const rows: FamilyListRow[] = parents
    .map((p) => {
      const balance = familyBalance(
        p.studentLinks.flatMap((l) =>
          l.student.fees.map((f) => ({
            amount: f.amount,
            totalPaid: f.payments.reduce((s, x) => s + x.amount, 0),
            dueDate: f.dueDate,
          })),
        ),
      );
      return {
        id: p.id,
        name: familyLabel(p, "Famille {name}"),
        parent: `${p.firstName} ${p.lastName}`.trim(),
        phone: p.phone,
        students: p.studentLinks.filter((l) => l.student.status === "ACTIVE").length,
        archived: p.studentLinks.every((l) => l.student.status !== "ACTIVE"),
        paid: balance.paid,
        due: balance.due,
        upcoming: balance.upcoming,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return <FamiliesView rows={rows} />;
}
