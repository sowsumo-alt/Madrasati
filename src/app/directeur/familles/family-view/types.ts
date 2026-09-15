/** Données de la fiche famille, calculées côté serveur (voir [parentId]/page.tsx). */

export interface FamilyChildRow {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  className: string | null;
  status: string;
  billed: number;
  paid: number;
  due: number;
}

/** Frais encore à régler, proposé dans le paiement familial. */
export interface FamilyOpenFee {
  feeId: string;
  studentId: string;
  studentName: string;
  className: string | null;
  label: string;
  remaining: number;
}

export type FamilyHistoryEntry =
  | {
      kind: "family";
      id: string;
      receiptNumber: string;
      paidAt: string;
      method: string;
      total: number;
      childNames: string[];
    }
  | {
      kind: "single";
      id: string;
      receiptNumber: string;
      paidAt: string;
      method: string;
      total: number;
      childName: string;
      feeLabel: string;
    };

/** Élève proposé au rattachement (même téléphone, ou recherche libre). */
export interface AttachCandidate {
  id: string;
  name: string;
  className: string | null;
  parentName: string | null;
}

export interface FamilyPageData {
  parentId: string;
  familyName: string | null;
  label: string;
  parent: {
    firstName: string;
    lastName: string;
    phone: string;
    address: string | null;
    relationship: string | null;
  };
  children: FamilyChildRow[];
  openFees: FamilyOpenFee[];
  history: FamilyHistoryEntry[];
  balance: { billed: number; paid: number; due: number };
  /** Élèves dont le parent a le même numéro, pas encore dans la famille. */
  suggestions: AttachCandidate[];
  /** Tous les élèves actifs hors de la famille, pour la recherche. */
  candidates: AttachCandidate[];
}
