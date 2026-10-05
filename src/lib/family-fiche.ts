import { fromMru, toMru, type AmountUnit } from "@/lib/money";
import { monthLabel } from "@/lib/tuition";
import { sheetErrors, todayIso, type FamilySheetInput, type SheetAlready } from "@/lib/family-sheet";

/**
 * La fiche de paiement telle que la secrétaire la remplit, pour toute la
 * famille : tous les enfants, et l'une des deux façons de facturer —
 *
 * - « Forfait famille » : un montant mensuel et une inscription, saisis une
 *   seule fois, portés par l'élève référent ; les autres enfants y sont
 *   « inclus » ;
 * - « Montant par enfant » : chaque enfant a son mensuel et son inscription,
 *   saisis par le directeur ; le dû d'un mois est la somme des mensuels.
 *
 * Une seule table des mois pour la famille. Un mois payé en partie, en mode
 * par enfant, est réparti dans l'ordre de la liste des enfants, et le
 * directeur peut changer la répartition.
 *
 * Rien n'est calculé ici d'autre que des additions : la fiche est convertie
 * en une fiche par enfant qui paie (FamilySheetInput), et c'est
 * lib/family-sheet.ts — la seule fonction de calcul — qui produit les lignes,
 * les totaux et les erreurs. Un élève seul est une fiche à un enfant.
 *
 * Sans dépendance à la base ni à React : testé à part (tests/family-sheet.test.ts).
 */

export const FICHE_MODES = ["FAMILY", "PER_CHILD"] as const;
export type FicheMode = (typeof FICHE_MODES)[number];

export const FICHE_MODE_LABELS: Record<FicheMode, string> = {
  FAMILY: "Forfait famille (montants saisis une seule fois)",
  PER_CHILD: "Montant par enfant",
};

export function isFicheMode(value: unknown): value is FicheMode {
  return value === "FAMILY" || value === "PER_CHILD";
}

/** Ce qui est tapé pour un enfant (ou pour la famille, en forfait), dans l'unité de l'école. */
export interface FicheAmounts {
  monthly: string;
  enrollmentDue: string;
  /** Vide : l'inscription (ou ce qui en reste) est versée en entier. */
  enrollmentPaid: string;
  /** Date du versement de l'inscription ; vide : aujourd'hui. */
  enrollmentDate?: string;
}

export interface FicheMonth {
  checked: boolean;
  /** Montant versé pour le mois, toute la famille ; vide : tout ce qui reste dû. */
  paid: string;
  /** Date du versement, AAAA-MM-JJ ; vide : aujourd'hui. */
  date?: string;
  /** Répartition modifiée par le directeur (mode par enfant) : la part de chaque enfant. */
  split?: Record<string, string>;
}

export interface FicheDraft {
  mode: FicheMode;
  /** L'élève référent : le nom porté sur la fiche papier (en forfait, il porte les montants). */
  referentKey: string;
  /** Premier mois facturé (ISO) ; absent : celui proposé par l'écran. */
  firstMonth?: string;
  /** Par enfant (clé) : ses montants. En forfait, seuls ceux du référent comptent. */
  amounts: Record<string, FicheAmounts>;
  /** Par mois (ISO). */
  months: Record<string, FicheMonth>;
  /** Dernière date tapée : reprise d'office pour le mois coché ensuite. */
  lastDate?: string;
}

export interface FicheChild {
  key: string;
  firstName: string;
}

const EMPTY: FicheAmounts = { monthly: "", enrollmentDue: "", enrollmentPaid: "" };

export function emptyAmounts(): FicheAmounts {
  return { ...EMPTY };
}

export function newFicheDraft(options: {
  mode: FicheMode;
  referentKey: string;
  keys: string[];
  unit: AmountUnit;
  /** Montant mensuel proposé (Paramètres de l'école), pour chaque enfant qui paie. */
  monthlyMru: number | null;
  /** Mois cochés d'office : juin, si l'école le fait payer à l'inscription. */
  prepaid: string[];
  firstMonth?: string;
  /** Montants déjà enregistrés (fiche reprise), en MRU, par enfant. */
  known?: Record<string, { monthly?: number | null; enrollment?: number | null }>;
}): FicheDraft {
  const amounts: Record<string, FicheAmounts> = {};
  for (const key of options.keys) {
    const known = options.known?.[key];
    // Le montant d'un mois des Paramètres n'est proposé qu'au référent : les
    // autres enfants sont « à saisir », rien n'est copié de l'un à l'autre.
    const monthly = known ? (known.monthly ?? null) : key === options.referentKey ? options.monthlyMru : null;
    amounts[key] = {
      ...EMPTY,
      monthly: monthly ? fromMru(monthly, options.unit) : "",
      enrollmentDue: known?.enrollment ? fromMru(known.enrollment, options.unit) : "",
    };
  }
  return {
    mode: options.mode,
    referentKey: options.referentKey,
    firstMonth: options.firstMonth,
    amounts,
    months: Object.fromEntries(options.prepaid.map((m) => [m, { checked: true, paid: "" }])),
  };
}

/** Les mois affichés : du premier mois facturé à la fin de l'année. */
export function ficheMonths(draft: FicheDraft, yearMonths: string[], defaultFirstMonth: string | undefined): string[] {
  const first = draft.firstMonth ?? defaultFirstMonth ?? yearMonths[0];
  return first ? yearMonths.filter((m) => m >= first) : yearMonths;
}

/** Les enfants qui portent des montants : le référent en forfait, chacun en mode par enfant. */
export function payingKeys(draft: FicheDraft, children: FicheChild[]): string[] {
  if (draft.mode === "FAMILY" || children.length <= 1) {
    return [children.some((c) => c.key === draft.referentKey) ? draft.referentKey : children[0]?.key].filter(
      (k): k is string => Boolean(k),
    );
  }
  return children.map((c) => c.key);
}

/** Où en est la saisie d'un enfant : saisi, à saisir, ou inclus dans le forfait familial. */
export function childStatus(draft: FicheDraft, children: FicheChild[], key: string): "DONE" | "TODO" | "INCLUDED" {
  if (!payingKeys(draft, children).includes(key)) return "INCLUDED";
  const a = draft.amounts[key];
  return a && (a.monthly.trim() || a.enrollmentDue.trim()) ? "DONE" : "TODO";
}

export interface FicheMonthRow {
  month: string;
  /** Dû du mois pour la famille : la somme des mensuels (ou des échéances déjà enregistrées). */
  due: number;
  /** Déjà reçu avant cette saisie. */
  before: number;
  /** Versé maintenant. */
  paid: number;
  /** La part de chaque enfant, dans l'ordre de la liste. */
  split: { key: string; due: number; before: number; paid: number }[];
  /** Répartition tapée par le directeur, plutôt que celle proposée. */
  customSplit: boolean;
}

export interface FicheConversion {
  /** Une fiche par enfant qui paie : ce que le serveur enregistre. */
  sheets: { key: string; input: FamilySheetInput }[];
  /** Mensuel de chaque enfant qui paie, en MRU. */
  monthly: Record<string, number>;
  /** Les mois cochés, avec leur répartition. */
  rows: Record<string, FicheMonthRow>;
  errors: string[];
}

/**
 * La fiche saisie → une fiche par enfant qui paie, en MRU entiers. Un mois
 * coché sans montant reçoit tout ce qui reste dû ; un montant plus petit est
 * réparti dans l'ordre des enfants, sauf répartition tapée par le directeur.
 */
export function ficheToSheets(
  draft: FicheDraft,
  options: {
    unit: AmountUnit;
    /** Tous les enfants de la fiche, dans l'ordre de la liste. */
    children: FicheChild[];
    /** Mois affichés (ficheMonths). */
    months: string[];
    /** Déjà reçu, par enfant (fiche reprise). */
    already?: Record<string, SheetAlready>;
    today?: string;
  },
): FicheConversion {
  const { unit, children, months } = options;
  const today = options.today ?? todayIso();
  const errors: string[] = [];
  const keys = payingKeys(draft, children);
  const named = keys.length > 1;
  const nameOf = (key: string) => children.find((c) => c.key === key)?.firstName ?? "";
  const prefix = (key: string | null) => (named && key ? `${nameOf(key)} — ` : "");
  const read = (raw: string, what: string, key: string | null) => {
    const { mru, error } = toMru(raw, unit);
    if (error) errors.push(`${prefix(key)}${what} : ${error}`);
    return mru;
  };

  const amountsOf = (key: string) => draft.amounts[key] ?? EMPTY;
  const monthly = Object.fromEntries(keys.map((k) => [k, read(amountsOf(k).monthly, "Montant mensuel", k)]));
  const enrollmentDue = Object.fromEntries(keys.map((k) => [k, read(amountsOf(k).enrollmentDue, "Frais d'inscription", k)]));

  const paidMonths: Record<string, FamilySheetInput["months"]> = Object.fromEntries(keys.map((k) => [k, []]));
  const rows: Record<string, FicheMonthRow> = {};
  for (const month of months) {
    const row = draft.months[month];
    if (!row?.checked) continue;
    const label = monthLabel(new Date(month));
    const date = row.date || today;
    const parts = keys.map((key) => {
      const known = options.already?.[key]?.months[month];
      const due = known ? known.due : monthly[key];
      const before = known?.paid ?? 0;
      return { key, due, before, left: Math.max(due - before, 0), paid: 0 };
    });
    const left = parts.reduce((sum, p) => sum + p.left, 0);
    const customSplit = named && Object.values(row.split ?? {}).some((v) => v.trim() !== "");
    if (customSplit) {
      for (const p of parts) {
        const raw = row.split?.[p.key] ?? "";
        p.paid = raw.trim() === "" ? 0 : read(raw, `${label}, part`, p.key);
      }
    } else {
      // Dans l'ordre de la liste : chaque enfant reçoit ce qui lui reste dû, jusqu'à épuisement.
      let rest = row.paid.trim() === "" ? left : read(row.paid, `${label}, montant versé`, null);
      for (const p of parts) {
        p.paid = Math.min(p.left, rest);
        rest -= p.paid;
      }
      if (rest > 0) errors.push(`${label} : le montant versé dépasse ce qui reste dû (${fromMru(left, unit)} ${unit}).`);
    }
    if (left === 0 && parts.every((p) => p.due === 0)) errors.push("Indiquez le montant mensuel avant de cocher des mois.");
    for (const p of parts) if (p.paid > 0) paidMonths[p.key].push({ month, paid: p.paid, date });
    rows[month] = {
      month,
      due: parts.reduce((sum, p) => sum + p.due, 0),
      before: parts.reduce((sum, p) => sum + p.before, 0),
      paid: parts.reduce((sum, p) => sum + p.paid, 0),
      split: parts.map(({ key, due, before, paid }) => ({ key, due, before, paid })),
      customSplit,
    };
  }

  const sheets = keys.map((key) => {
    const a = amountsOf(key);
    const already = options.already?.[key];
    const enrollmentLeft = Math.max(enrollmentDue[key] - (already?.enrollment?.paid ?? 0), 0);
    const enrollmentPaid = a.enrollmentPaid.trim() === "" ? enrollmentLeft : read(a.enrollmentPaid, "Inscription versée", key);
    const input: FamilySheetInput = {
      referentIndex: Math.max(0, children.findIndex((c) => c.key === key)),
      monthly: monthly[key],
      firstMonth: months[0],
      enrollment: { due: enrollmentDue[key], paid: enrollmentPaid, date: a.enrollmentDate || today },
      months: paidMonths[key],
      already,
    };
    for (const e of sheetErrors(input, today)) errors.push(`${prefix(key)}${e}`);
    return { key, input };
  });

  return { sheets, monthly, rows, errors: [...new Set(errors)] };
}
