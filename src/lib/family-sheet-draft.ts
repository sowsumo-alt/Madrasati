import { fromMru, toMru, type AmountUnit } from "@/lib/money";
import { sheetErrors, type FamilySheetInput } from "@/lib/family-sheet";

/**
 * Saisie en cours d'une fiche de paiement, telle que tapée par la secrétaire
 * — dans l'unité de l'école (MRU ou MRO). Convertie en fiche (MRU entiers)
 * par sheetDraftToInput, la seule passerelle entre l'écran et le calcul.
 *
 * Sans dépendance à React : testé à part (tests/family-sheet.test.ts).
 */
export interface SheetDraft {
  /** Clé de l'enfant référent (ChildDraft.key). */
  referentKey: string;
  monthly: string;
  enrollmentDue: string;
  /** Vide : l'inscription est versée en entier. */
  enrollmentPaid: string;
  /** Par mois (ISO) : coché « payé aujourd'hui », et le montant versé (vide : le montant mensuel). */
  months: Record<string, { checked: boolean; paid: string }>;
}

export function newSheetDraft(options: {
  referentKey: string;
  monthlyMru: number | null;
  unit: AmountUnit;
  /** Mois cochés d'office : juin, si l'école le fait payer à l'inscription. */
  prepaid: string[];
}): SheetDraft {
  return {
    referentKey: options.referentKey,
    monthly: options.monthlyMru ? fromMru(options.monthlyMru, options.unit) : "",
    enrollmentDue: "",
    enrollmentPaid: "",
    months: Object.fromEntries(options.prepaid.map((m) => [m, { checked: true, paid: "" }])),
  };
}

export interface DraftConversion {
  input: FamilySheetInput;
  /** Erreurs de saisie et de cohérence, en clair ; vide : la fiche peut être enregistrée. */
  errors: string[];
}

/** La fiche en MRU entiers, à partir de ce qui a été tapé. */
export function sheetDraftToInput(
  draft: SheetDraft,
  options: { unit: AmountUnit; referentIndex: number; months: string[] },
): DraftConversion {
  const errors: string[] = [];
  const read = (raw: string, what: string) => {
    const { mru, error } = toMru(raw, options.unit);
    if (error) errors.push(`${what} : ${error}`);
    return mru;
  };
  const monthly = read(draft.monthly, "Montant mensuel");
  const enrollmentDue = read(draft.enrollmentDue, "Frais d'inscription");
  const enrollmentPaid = draft.enrollmentPaid.trim() === "" ? enrollmentDue : read(draft.enrollmentPaid, "Inscription versée");
  const months = options.months
    .filter((m) => draft.months[m]?.checked)
    .map((m) => {
      const raw = draft.months[m].paid;
      return { month: m, paid: raw.trim() === "" ? monthly : read(raw, "Montant versé") };
    });
  const input: FamilySheetInput = {
    referentIndex: options.referentIndex,
    monthly,
    enrollment: { due: enrollmentDue, paid: enrollmentPaid },
    months,
  };
  return { input, errors: [...errors, ...sheetErrors(input)] };
}
