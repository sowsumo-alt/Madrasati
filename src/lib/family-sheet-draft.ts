import { fromMru, toMru, type AmountUnit } from "@/lib/money";
import { sheetErrors, todayIso, type FamilySheetInput, type SheetAlready } from "@/lib/family-sheet";

/**
 * Saisie en cours d'une fiche de paiement, telle que tapée par la secrétaire
 * — dans l'unité de l'école (MRU ou MRO). Convertie en fiche (MRU entiers)
 * par sheetDraftToInput, la seule passerelle entre l'écran et le calcul.
 *
 * Sans dépendance à React : testé à part (tests/family-sheet.test.ts).
 */
export interface SheetMonthDraft {
  checked: boolean;
  /** Vide : le montant mensuel (ou le reste dû du mois). */
  paid: string;
  /** Date du versement, AAAA-MM-JJ ; vide : aujourd'hui. */
  date?: string;
}

export interface SheetDraft {
  /** Clé de l'enfant référent (ChildDraft.key, ou l'id de l'élève). */
  referentKey: string;
  monthly: string;
  /** Premier mois facturé (ISO) ; absent : celui proposé par l'écran. */
  firstMonth?: string;
  enrollmentDue: string;
  /** Vide : l'inscription (ou ce qui en reste) est versée en entier. */
  enrollmentPaid: string;
  /** Date du versement de l'inscription ; vide : aujourd'hui. */
  enrollmentDate?: string;
  /** Par mois (ISO) : coché « payé », le montant versé et sa date. */
  months: Record<string, SheetMonthDraft>;
  /**
   * Dernière date tapée : reprise d'office pour le mois coché ensuite —
   * une fiche papier recopiée a souvent la même date sur plusieurs lignes.
   */
  lastDate?: string;
}

export function newSheetDraft(options: {
  referentKey: string;
  monthlyMru: number | null;
  unit: AmountUnit;
  /** Mois cochés d'office : juin, si l'école le fait payer à l'inscription. */
  prepaid: string[];
  firstMonth?: string;
  enrollmentDueMru?: number | null;
}): SheetDraft {
  return {
    referentKey: options.referentKey,
    monthly: options.monthlyMru ? fromMru(options.monthlyMru, options.unit) : "",
    firstMonth: options.firstMonth,
    enrollmentDue: options.enrollmentDueMru ? fromMru(options.enrollmentDueMru, options.unit) : "",
    enrollmentPaid: "",
    months: Object.fromEntries(options.prepaid.map((m) => [m, { checked: true, paid: "" }])),
  };
}

/** Les mois affichés : du premier mois facturé à la fin de l'année. */
export function sheetMonths(draft: SheetDraft, yearMonths: string[], defaultFirstMonth: string | undefined): string[] {
  const first = draft.firstMonth ?? defaultFirstMonth ?? yearMonths[0];
  return first ? yearMonths.filter((m) => m >= first) : yearMonths;
}

export interface DraftConversion {
  input: FamilySheetInput;
  /** Erreurs de saisie et de cohérence, en clair ; vide : la fiche peut être enregistrée. */
  errors: string[];
}

/** La fiche en MRU entiers, à partir de ce qui a été tapé. */
export function sheetDraftToInput(
  draft: SheetDraft,
  options: {
    unit: AmountUnit;
    referentIndex: number;
    /** Mois affichés (sheetMonths). */
    months: string[];
    already?: SheetAlready;
    today?: string;
  },
): DraftConversion {
  const errors: string[] = [];
  const today = options.today ?? todayIso();
  const read = (raw: string, what: string) => {
    const { mru, error } = toMru(raw, options.unit);
    if (error) errors.push(`${what} : ${error}`);
    return mru;
  };
  const already = options.already;
  const monthly = read(draft.monthly, "Montant mensuel");
  const enrollmentDue = read(draft.enrollmentDue, "Frais d'inscription");
  const enrollmentLeft = Math.max(enrollmentDue - (already?.enrollment?.paid ?? 0), 0);
  const enrollmentPaid =
    draft.enrollmentPaid.trim() === "" ? enrollmentLeft : read(draft.enrollmentPaid, "Inscription versée");
  const months = options.months
    .filter((m) => draft.months[m]?.checked)
    .map((m) => {
      const row = draft.months[m];
      const before = already?.months[m];
      const left = before ? Math.max(before.due - before.paid, 0) : monthly;
      return {
        month: m,
        paid: row.paid.trim() === "" ? left : read(row.paid, "Montant versé"),
        date: row.date || today,
      };
    });
  const input: FamilySheetInput = {
    referentIndex: options.referentIndex,
    monthly,
    firstMonth: options.months[0],
    enrollment: { due: enrollmentDue, paid: enrollmentPaid, date: draft.enrollmentDate || today },
    months,
    already,
  };
  return { input, errors: [...errors, ...sheetErrors(input, today)] };
}
