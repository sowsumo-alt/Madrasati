import { prisma } from "@/lib/prisma";
import { DEFAULT_OFFICIAL_HEADER, type OfficialHeaderText } from "@/lib/official-header";

const ROW_ID = "default";

export interface LoadedOfficialHeader extends OfficialHeaderText {
  /** Vrai tant que le Super Admin n'a pas remplacé le texte livré. */
  isDefault: boolean;
  updatedAt: Date | null;
}

/** Bloc officiel en vigueur, le même pour toutes les écoles. */
export async function loadOfficialHeader(): Promise<LoadedOfficialHeader> {
  const row = await prisma.officialHeader.findUnique({ where: { id: ROW_ID } });
  if (!row || row.linesFr.length === 0 || row.linesAr.length === 0) {
    return { ...DEFAULT_OFFICIAL_HEADER, isDefault: true, updatedAt: null };
  }
  return { linesFr: row.linesFr, linesAr: row.linesAr, isDefault: false, updatedAt: row.updatedAt };
}

/** Réservé au Super Admin : l'appelant vérifie le compte avant. */
export async function saveOfficialHeader(text: OfficialHeaderText, updatedBy: string) {
  await prisma.officialHeader.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, ...text, updatedBy },
    update: { ...text, updatedBy },
  });
}

/** Retour au texte livré avec Madrasati. */
export async function resetOfficialHeader() {
  await prisma.officialHeader.deleteMany({ where: { id: ROW_ID } });
}
