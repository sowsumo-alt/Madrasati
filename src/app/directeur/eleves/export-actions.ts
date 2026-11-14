"use server";

import { z } from "zod";
import { basePrisma, prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { ACTIVITY_ACTIONS, logActivity } from "@/lib/activity";
import { UserError, asResult } from "@/lib/user-error";
import { compareClasses } from "@/lib/class-catalog";
import { familyLabel } from "@/lib/family";
import { filterStudents, parseStudentsParams, type StudentsListState } from "@/lib/students-query";
import type { StudentsWordData, WordClassGroup } from "@/lib/students-word";

const STATUS_LABELS: Record<Exclude<StudentsListState["status"], "ALL">, string> = {
  ACTIVE: "Élèves actifs",
  INACTIVE: "Élèves retirés",
  TRANSFERRED: "Élèves transférés",
  GRADUATED: "Élèves diplômés",
};

/**
 * La liste des élèves telle qu'elle est filtrée à l'écran (recherche, classe,
 * statut, lettre, famille), toutes pages comprises, regroupée par classe pour
 * le fichier Word. L'export est inscrit au journal : il contient les
 * téléphones des parents.
 */
export async function studentsWordExport(listParams: string) {
  return asResult(async (): Promise<{ data: StudentsWordData }> => {
    const user = await requireRole(ROLES.DIRECTOR);
    const parsed = z.string().max(500).safeParse(listParams);
    if (!parsed.success) throw new UserError("Filtres de la liste illisibles.");
    const state = parseStudentsParams(Object.fromEntries(new URLSearchParams(parsed.data)));

    const [students, classes, school, year] = await Promise.all([
      prisma.student.findMany({
        where: { schoolId: user.schoolId },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: {
          firstName: true,
          lastName: true,
          matricule: true,
          gender: true,
          dateOfBirth: true,
          status: true,
          classId: true,
          classRoom: { select: { name: true } },
          parentLinks: {
            where: { isPrimary: true },
            take: 1,
            select: { parent: { select: { id: true, firstName: true, lastName: true, familyName: true, phone: true } } },
          },
        },
      }),
      prisma.classRoom.findMany({
        where: { schoolId: user.schoolId },
        select: { id: true, name: true, level: true, category: true },
      }),
      prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }),
      prisma.academicYear.findFirst({ where: { schoolId: user.schoolId, isCurrent: true }, select: { label: true } }),
    ]);

    const rows = filterStudents(
      students.map((s) => ({ ...s, className: s.classRoom?.name ?? null, parent: s.parentLinks[0]?.parent ?? null })),
      state,
    );
    if (rows.length === 0) throw new UserError("Aucun élève dans cette liste : rien à exporter.");

    // Une page par classe, dans l'ordre des classes de l'école ; « Sans classe » à la fin.
    const order = [...classes].sort(compareClasses).map((c) => c.id);
    const byClass = new Map<string | null, typeof rows>();
    for (const row of rows) byClass.set(row.classId, [...(byClass.get(row.classId) ?? []), row]);
    const rank = (id: string | null) => (id === null ? Number.MAX_SAFE_INTEGER : order.indexOf(id));
    const groups: WordClassGroup[] = [...byClass.entries()]
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([, list]) => ({
        className: list[0].className ?? "Sans classe",
        students: list.map((s) => ({
          firstName: s.firstName,
          lastName: s.lastName,
          matricule: s.matricule,
          gender: s.gender,
          dateOfBirth: s.dateOfBirth ? s.dateOfBirth.toISOString().slice(0, 10) : null,
          parentName: s.parent ? `${s.parent.firstName} ${s.parent.lastName}`.trim() : "",
          phone: s.parent?.phone ?? "",
        })),
      }));

    const family = state.family ? rows.find((r) => r.parent?.id === state.family)?.parent : null;
    const filterLabel =
      [
        state.status !== "ALL" ? STATUS_LABELS[state.status] : null,
        state.query.trim() ? `Recherche « ${state.query.trim()} »` : null,
        state.letter ? `Initiale ${state.letter}` : null,
        family ? familyLabel(family, "Famille {name}") : null,
      ]
        .filter(Boolean)
        .join(" · ") || null;

    await logActivity(basePrisma, {
      schoolId: user.schoolId,
      userId: user.id,
      action: ACTIVITY_ACTIONS.EXPORT,
      summary: `Export Word de la liste des élèves (${rows.length} élève${rows.length > 1 ? "s" : ""}${groups.length === 1 ? `, ${groups[0].className}` : ""})`,
    });

    return {
      data: {
        schoolName: school?.name ?? "Madrasati",
        yearLabel: year?.label ?? null,
        filterLabel,
        exportedOn: new Date().toISOString().slice(0, 10),
        groups,
      },
    };
  });
}
