"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/super-admin-session";
import { OFFICIAL_HEADER_MAX_LINES } from "@/lib/official-header";
import { resetOfficialHeader, saveOfficialHeader } from "@/lib/official-header-data";

const lines = z
  .array(z.string().trim().min(1).max(120))
  .min(1, "Au moins une ligne est requise.")
  .max(OFFICIAL_HEADER_MAX_LINES, `${OFFICIAL_HEADER_MAX_LINES} lignes au plus.`);

const schema = z.object({ linesFr: lines, linesAr: lines });

/**
 * Change le bloc officiel des bulletins de TOUTES les écoles. Seul point
 * d'écriture : aucun écran directeur n'y a accès.
 */
export async function updateOfficialHeader(values: { linesFr: string[]; linesAr: string[] }) {
  const admin = await requireSuperAdmin();
  const data = schema.parse(values);
  await saveOfficialHeader(data, admin.email);
  revalidatePath("/super-admin/en-tete-officiel");
  revalidatePath("/directeur", "layout");
}

export async function restoreDefaultOfficialHeader() {
  await requireSuperAdmin();
  await resetOfficialHeader();
  revalidatePath("/super-admin/en-tete-officiel");
  revalidatePath("/directeur", "layout");
}
