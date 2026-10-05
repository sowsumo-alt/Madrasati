import type { PaymentMethod } from "@/lib/payment-methods";
import type { FamilySheetInput } from "@/lib/family-sheet";
import type { FicheMode } from "@/lib/family-fiche";
import { parseAmount } from "@/lib/family";
import {
  familyChildSchema,
  familyEnrollmentSchema,
  type FamilyEnrollmentValues,
  type FamilyPaymentMode,
} from "../schema";

/** Saisie en cours de l'étape « Famille ». */
export interface FamilyDraft {
  /** Famille déjà enregistrée que l'on complète (même téléphone), sinon "". */
  existingParentId: string;
  familyName: string;
  parentName: string;
  parentPhone: string;
  parentAddress: string;
}

/** Saisie en cours d'un enfant ; le montant reste du texte pendant la frappe. */
export interface ChildDraft {
  key: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "" | "M" | "F";
  placeOfBirth: string;
  nni: string;
  rimNumber: string;
  classId: string;
  amount: string;
}

export type FieldErrors = Partial<Record<string, string>>;

let keySeed = 0;

export function newChild(lastName = ""): ChildDraft {
  keySeed += 1;
  return {
    // Unique même après la reprise d'un brouillon : le compteur repart de
    // zéro au rechargement, les enfants repris gardent leur clé.
    key: `enfant-${Date.now().toString(36)}-${keySeed}`,
    firstName: "",
    lastName,
    dateOfBirth: "",
    gender: "",
    placeOfBirth: "",
    nni: "",
    rimNumber: "",
    classId: "",
    amount: "",
  };
}

const familyStepSchema = familyEnrollmentSchema.pick({
  familyName: true,
  parentName: true,
  parentPhone: true,
  parentAddress: true,
});

const childStepSchema = familyChildSchema.omit({ amount: true });

function issuesToErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "");
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}

/** Erreurs de l'étape « Famille », champ par champ (vide = étape valide). */
export function familyStepErrors(draft: FamilyDraft): FieldErrors {
  const parsed = familyStepSchema.safeParse(draft);
  return parsed.success ? {} : issuesToErrors(parsed.error.issues);
}

/** Erreurs de l'étape « Enfants », rangées par enfant (clé du brouillon). */
export function childrenStepErrors(children: ChildDraft[]): Record<string, FieldErrors> {
  const result: Record<string, FieldErrors> = {};
  for (const child of children) {
    const parsed = childStepSchema.safeParse(child);
    if (!parsed.success) result[child.key] = issuesToErrors(parsed.error.issues);
  }
  return result;
}

/** Données envoyées au serveur, montants convertis en MRU entiers. */
export function toEnrollmentValues(
  draft: FamilyDraft,
  children: ChildDraft[],
  paymentMode: FamilyPaymentMode,
  method: PaymentMethod,
  /** La ou les fiches de paiement, en MRU : une par enfant qui paie. */
  sheets?: FamilySheetInput[],
  /** Forfait famille ou montant par enfant, et l'élève référent (rang dans la liste). */
  fiche?: { mode: FicheMode; referentIndex: number },
): FamilyEnrollmentValues {
  return {
    existingParentId: draft.existingParentId,
    familyName: draft.familyName,
    parentName: draft.parentName,
    parentPhone: draft.parentPhone,
    parentAddress: draft.parentAddress,
    children: children.map((c) => ({
      firstName: c.firstName,
      lastName: c.lastName,
      dateOfBirth: c.dateOfBirth,
      gender: c.gender,
      placeOfBirth: c.placeOfBirth,
      nni: c.nni,
      rimNumber: c.rimNumber ?? "",
      classId: c.classId,
      amount: parseAmount(c.amount),
    })),
    paymentMode,
    method,
    sheets,
    sheetMode: fiche?.mode,
    referentIndex: fiche?.referentIndex,
  };
}
