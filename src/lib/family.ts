/**
 * Familles : un parent (ou tuteur) et les enfants qui lui sont rattachés.
 *
 * Aucune table « famille » à part : le lien parent ↔ enfants existait déjà
 * (StudentParent), et les frères et sœurs inscrits un par un partagent déjà
 * la même fiche parent (même nom, même téléphone — voir createStudent). Les
 * familles déjà présentes dans une école apparaissent donc d'elles-mêmes, sans
 * rien ressaisir. Seul le nom affiché (« Famille BA ») est facultatif en plus.
 *
 * Sans dépendance à React ni à Prisma, pour être testé à part.
 */

/** Nom saisi pour la famille, ou null s'il faut l'afficher d'après le nom
 *  du parent (« Famille » + nom, traduit par l'interface). */
export function customFamilyName(parent: { familyName: string | null }): string | null {
  const name = parent.familyName?.trim();
  return name ? name : null;
}

/**
 * Nom affiché d'une famille. `defaultTemplate` porte « {name} », ex:
 * « Famille {name} » en français, « عائلة {name} » en arabe.
 */
export function familyLabel(
  parent: { familyName: string | null; lastName: string },
  defaultTemplate: string,
): string {
  return customFamilyName(parent) ?? defaultTemplate.replace("{name}", parent.lastName.trim());
}

export interface FamilyFeeAmounts {
  amount: number;
  totalPaid: number;
}

export interface FamilyBalance {
  /** Total facturé pour tous les enfants. */
  billed: number;
  /** Total déjà encaissé. */
  paid: number;
  /** Reste dû, frais par frais : un trop-perçu sur l'un ne comble pas l'autre. */
  due: number;
}

/** Situation financière globale d'une famille, tous enfants confondus. */
export function familyBalance(fees: FamilyFeeAmounts[]): FamilyBalance {
  return fees.reduce<FamilyBalance>(
    (acc, f) => ({
      billed: acc.billed + f.amount,
      paid: acc.paid + f.totalPaid,
      due: acc.due + Math.max(f.amount - f.totalPaid, 0),
    }),
    { billed: 0, paid: 0, due: 0 },
  );
}

/**
 * Montant saisi dans un champ, en MRU entiers : vide, négatif ou illisible
 * compte pour 0, pour que le total affiché reste juste pendant la frappe.
 */
export function parseAmount(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(String(value).replace(/\s/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Total familial : la somme des montants saisis pour chaque enfant. */
export function familyTotal(amounts: (string | number | null | undefined)[]): number {
  return amounts.reduce<number>((sum, a) => sum + parseAmount(a), 0);
}

/**
 * Vérifie les parts d'un paiement familial avant enregistrement : au moins
 * une part, aucune au-delà du reste dû de son frais, et un même frais cité une
 * seule fois. Renvoie le message d'erreur, ou null si tout est correct.
 */
export function checkFamilyParts(
  parts: { feeId: string; amount: number }[],
  remainingByFee: Map<string, number>,
): string | null {
  const positive = parts.filter((p) => p.amount > 0);
  if (positive.length === 0) return "Saisissez au moins un montant.";
  const seen = new Set<string>();
  for (const p of positive) {
    if (seen.has(p.feeId)) return "Un même frais apparaît deux fois.";
    seen.add(p.feeId);
    const remaining = remainingByFee.get(p.feeId);
    if (remaining == null) return "Frais introuvable.";
    if (p.amount > remaining) return "Un montant dépasse le reste dû de son frais.";
  }
  return null;
}
