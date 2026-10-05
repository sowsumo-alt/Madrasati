"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { runWithReceipt } from "@/lib/receipts";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { familySheetSchema } from "@/lib/family-sheet";
import { recordFamilySheet, recordSheetPayments, type DatedPart } from "@/lib/family-sheet-data";
import { UserError, asResult } from "@/lib/user-error";
import { ACTIVITY_ACTIONS, logActivity } from "@/lib/activity";

const saveSchema = z.object({
  /** La famille dont on saisit la fiche ; absent : un élève seul. */
  parentId: z.string().min(1).optional(),
  method: z.enum(PAYMENT_METHODS),
  sheets: z
    .array(z.object({ studentId: z.string().min(1), sheet: familySheetSchema }))
    .min(1)
    .max(20),
});
export type SaveSheetInput = z.input<typeof saveSchema>;

/**
 * Fiche de paiement d'élèves déjà inscrits (saisis à la main ou importés) :
 * la reprise d'une fiche papier, ligne par ligne, avec ses dates — ou une
 * correction (montant mensuel, inscription). Le même enregistrement que
 * l'inscription (recordFamilySheet), sans recréer aucun élève ; un reçu par
 * date de versement.
 */
export async function saveSheetAction(input: SaveSheetInput) {
  return asResult(async () => {
    const user = await requireRole(ROLES.DIRECTOR);
    const data = saveSchema.parse(input);

    const [school, year, students] = await Promise.all([
      prisma.school.findUnique({ where: { id: user.schoolId }, select: { familySheetMode: true } }),
      prisma.academicYear.findFirst({
        where: { schoolId: user.schoolId, isCurrent: true },
        select: { id: true, label: true, startDate: true, endDate: true },
      }),
      prisma.student.findMany({
        where: { id: { in: data.sheets.map((s) => s.studentId) }, schoolId: user.schoolId },
        select: { id: true },
      }),
    ]);
    if (!year) throw new UserError("Aucune année scolaire active.");
    if (students.length !== new Set(data.sheets.map((s) => s.studentId)).size) throw new UserError("Élève introuvable.");

    // Une fiche familiale : la famille a plusieurs enfants actifs, l'école
    // tient une fiche par famille, et une seule fiche est saisie.
    let familyParentId: string | null = null;
    if (data.parentId) {
      const parent = await prisma.parent.findFirst({
        where: { id: data.parentId, schoolId: user.schoolId },
        select: { id: true, studentLinks: { select: { studentId: true, student: { select: { status: true } } } } },
      });
      if (!parent) throw new UserError("Famille introuvable.");
      const childIds = new Set(parent.studentLinks.map((l) => l.studentId));
      if (data.sheets.some((s) => !childIds.has(s.studentId))) throw new UserError("Cet élève n'est pas de cette famille.");
      const active = parent.studentLinks.filter((l) => l.student.status === "ACTIVE").length;
      if (school?.familySheetMode !== "PER_CHILD" && data.sheets.length === 1 && active >= 2) familyParentId = parent.id;
    }

    const receipts = await runWithReceipt(async (tx, attempt) => {
      const now = new Date();
      const parts: DatedPart[] = [];
      for (const { studentId, sheet } of data.sheets) {
        parts.push(
          ...(await recordFamilySheet(tx, {
            schoolId: user.schoolId,
            year,
            familyParentId,
            referentStudentId: studentId,
            sheet,
            firstMonth: year.startDate,
            now,
          })),
        );
      }
      const named = await tx.student.findMany({
        where: { id: { in: data.sheets.map((s) => s.studentId) } },
        select: { firstName: true, lastName: true },
      });
      await logActivity(tx, {
        schoolId: user.schoolId,
        userId: user.id,
        action: ACTIVITY_ACTIONS.SHEET,
        summary: `Fiche de paiement enregistrée — ${named.map((s) => `${s.firstName} ${s.lastName}`.trim()).join(", ")}`,
        href: data.parentId ? `/directeur/familles/${data.parentId}` : `/directeur/fiche?eleve=${data.sheets[0].studentId}`,
      });
      return recordSheetPayments(tx, {
        schoolId: user.schoolId,
        parts,
        method: data.method,
        userId: user.id,
        attempt,
        now,
        parentId: data.parentId,
        forceGroup: Boolean(familyParentId) || data.sheets.length > 1,
      });
    });

    revalidatePath("/directeur/finance");
    revalidatePath("/directeur/eleves");
    revalidatePath("/directeur/familles");
    revalidatePath("/directeur");
    if (data.parentId) revalidatePath(`/directeur/familles/${data.parentId}`);
    return { receipts };
  });
}
