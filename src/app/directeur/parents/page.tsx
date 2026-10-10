import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { loadDueRule } from "@/lib/due-rule-data";
import { effectiveDueDate } from "@/lib/due-rule";
import { schoolHasFeature, FEATURES } from "@/lib/plans";
import { familyBalance } from "@/lib/family";
import { pageOf, pageParam, textParam } from "@/lib/list-page";
import { ParentsView, type ParentRow } from "./parents-view";

const PAGE_SIZE = 20;

export default async function ParentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const params = await searchParams;
  const query = textParam(params.q);

  // Tous les parents, noms seulement : la recherche porte sur eux et leurs
  // enfants. Les frais (pour le solde) ne sont lus que pour la page affichée.
  const [parents, students, school, dueRule] = await Promise.all([
    prisma.parent.findMany({
      where: { schoolId: user.schoolId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        address: true,
        relationship: true,
        familyName: true,
        userId: true,
        user: { select: { email: true } },
        studentLinks: {
          select: {
            student: { select: { id: true, firstName: true, lastName: true, classRoom: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.student.findMany({
      where: { schoolId: user.schoolId, status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, classRoom: { select: { name: true } } },
    }),
    prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true, plan: true, subscriptionStatus: true } }),
    loadDueRule(user.schoolId),
  ]);

  // Même recherche qu'avant : nom du parent ou d'un enfant, sans tenir compte des majuscules.
  const q = query.trim().toLowerCase();
  const matching = q
    ? parents.filter(
        (p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          p.studentLinks.some((l) => `${l.student.firstName} ${l.student.lastName}`.toLowerCase().includes(q)),
      )
    : parents;
  const list = pageOf(matching, pageParam(params.page), PAGE_SIZE);

  const childIds = list.rows.flatMap((p) => p.studentLinks.map((l) => l.student.id));
  const fees = childIds.length
    ? await prisma.fee.findMany({
        where: { schoolId: user.schoolId, studentId: { in: childIds } },
        select: { studentId: true, amount: true, dueDate: true, periodStart: true, payments: { select: { amount: true } } },
      })
    : [];

  const rows: ParentRow[] = list.rows.map((p) => {
    const ids = new Set(p.studentLinks.map((l) => l.student.id));
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone,
      email: p.email,
      address: p.address,
      relationship: p.relationship,
      familyName: p.familyName,
      children: p.studentLinks.map((l) => ({
        id: l.student.id,
        name: `${l.student.firstName} ${l.student.lastName}`,
        className: l.student.classRoom?.name ?? null,
      })),
      // Situation de toute la famille, frais par frais, tous enfants confondus.
      balance: familyBalance(
        fees
          .filter((f) => ids.has(f.studentId))
          .map((f) => ({
            amount: f.amount,
            totalPaid: f.payments.reduce((sum, x) => sum + x.amount, 0),
            dueDate: effectiveDueDate(f, dueRule),
          })),
      ),
      userId: p.userId,
      accountEmail: p.user?.email ?? null,
    };
  });

  return (
    <ParentsView
      parents={rows}
      query={query}
      page={list.page}
      pageCount={list.pageCount}
      total={list.total}
      hasParents={parents.length > 0}
      pageSize={PAGE_SIZE}
      students={students.map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        className: s.classRoom?.name ?? null,
      }))}
      schoolName={school?.name ?? "Madrasati"}
      parentPortalEnabled={schoolHasFeature(school, FEATURES.PARENT_PORTAL)}
    />
  );
}
