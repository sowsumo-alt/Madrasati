"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { UserError, asResult } from "@/lib/user-error";
import { familyLabel } from "@/lib/family";
import { archiveStudents, deleteFamily, deleteStudents, sameName } from "@/lib/removal";
import { ACTIVITY_ACTIONS, logActivity } from "@/lib/activity";

export interface RemovalPreview {
  /** Le nom à recopier pour confirmer. */
  name: string;
  /** Paiements enregistrés : il y a de l'argent, l'archivage est recommandé. */
  payments: number;
  paidTotal: number;
  /** Famille : nombre d'enfants. */
  children: number;
}

const kindSchema = z.enum(["student", "family"]);

/** Ce que la fenêtre de suppression doit savoir : le nom exact et l'argent en jeu. */
export async function removalPreview(kind: "student" | "family", id: string) {
  return asResult(async (): Promise<RemovalPreview> => {
    const user = await requireRole(ROLES.DIRECTOR);
    if (kindSchema.parse(kind) === "student") {
      const s = await prisma.student.findFirst({ where: { id, schoolId: user.schoolId } });
      if (!s) throw new UserError("Élève introuvable.");
      const agg = await prisma.payment.aggregate({ where: { studentId: id }, _count: true, _sum: { amount: true } });
      return { name: `${s.firstName} ${s.lastName}`.trim(), payments: agg._count, paidTotal: agg._sum.amount ?? 0, children: 1 };
    }
    const p = await prisma.parent.findFirst({
      where: { id, schoolId: user.schoolId },
      include: { studentLinks: { select: { studentId: true } } },
    });
    if (!p) throw new UserError("Famille introuvable.");
    const ids = p.studentLinks.map((l) => l.studentId);
    const agg = await prisma.payment.aggregate({ where: { studentId: { in: ids } }, _count: true, _sum: { amount: true } });
    return {
      name: familyLabel(p, "Famille {name}"),
      payments: agg._count,
      paidTotal: agg._sum.amount ?? 0,
      children: ids.length,
    };
  });
}

const removeSchema = z.object({
  kind: kindSchema,
  id: z.string().min(1),
  mode: z.enum(["ARCHIVE", "DELETE"]),
  /** Le nom recopié par le directeur : deuxième étape de la confirmation. */
  confirmName: z.string().max(200),
});

/**
 * Archiver ou supprimer définitivement un élève ou une famille (voir
 * lib/removal.ts). Réservé au directeur, confirmé en recopiant le nom.
 */
export async function removeAction(input: z.infer<typeof removeSchema>) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    const data = removeSchema.parse(input);
    const preview = await removalPreview(data.kind, data.id);
    if (!preview.ok) throw new UserError(preview.error);
    if (!sameName(data.confirmName, preview.name)) {
      throw new UserError(`Recopiez exactement « ${preview.name} » pour confirmer.`);
    }

    await prisma.$transaction(
      async (tx) => {
        if (data.kind === "student") {
          if (data.mode === "ARCHIVE") await archiveStudents(tx, user.schoolId, [data.id]);
          else await deleteStudents(tx, user.schoolId, [data.id]);
        } else if (data.mode === "DELETE") {
          await deleteFamily(tx, user.schoolId, data.id);
        } else {
          const links = await tx.studentParent.findMany({ where: { parentId: data.id }, select: { studentId: true } });
          await archiveStudents(tx, user.schoolId, links.map((l) => l.studentId));
        }
        // Qui a archivé ou supprimé : la trace reste, même quand les données partent.
        const what = data.kind === "student" ? "Élève" : "Famille";
        await logActivity(tx, {
          schoolId: user.schoolId,
          userId: user.id,
          action: data.mode === "DELETE" ? ACTIVITY_ACTIONS.DELETE : ACTIVITY_ACTIONS.ARCHIVE,
          summary:
            data.mode === "DELETE"
              ? // Sans le nom : la suppression définitive efface aussi les noms du journal.
                `${what} supprimé(e) définitivement${preview.payments > 0 ? ` — ${preview.payments} paiement(s) effacé(s)` : ""}`
              : `${what} archivé(e) : ${preview.name}`,
          amount: data.mode === "DELETE" && preview.paidTotal > 0 ? preview.paidTotal : null,
        });
      },
      { timeout: 60_000 },
    );

    for (const path of ["/directeur", "/directeur/eleves", "/directeur/finance", "/directeur/parents", "/directeur/statistiques"]) {
      revalidatePath(path);
    }
    revalidatePath("/directeur/familles", "layout");
    return { kind: data.kind, mode: data.mode };
  });
}
