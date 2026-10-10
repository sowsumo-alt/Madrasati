/**
 * Liste des paiements paginée côté serveur : les filtres vivent dans l'adresse
 * (?q=…&statut=impayes&page=2), le serveur applique exactement les mêmes
 * règles qu'avant (matchesFeeFilters) et n'envoie au téléphone que la page
 * affichée — et non les milliers de frais d'une grande école.
 *
 * Sans dépendance à la base ni à React, pour être testé à part
 * (tests/payments-query.test.ts).
 */

import { LETTERS, matchesLetter } from "./initials";
import {
  PAYMENT_STATUS_FILTERS,
  matchesFeeFilters,
  type FeeListFilters,
  type FeeListItem,
  type PaymentStatusFilter,
} from "./payments-list";

export const PAYMENTS_PAGE_SIZE = 10;

export interface PaymentsListState {
  filters: FeeListFilters;
  /** Lettre du filtre A-Z, ou null. */
  letter: string | null;
  /** Frais d'une même famille (identifiant du parent), ou null. */
  family: string | null;
  page: number;
}

/** Statut ↔ mot de l'adresse ; « impayes » était déjà celui du menu « Impayés ». */
const STATUS_WORDS: Record<Exclude<PaymentStatusFilter, "ALL">, string> = {
  UNPAID: "impayes",
  PAID: "regles",
  PARTIAL: "partiels",
  OVERDUE: "en-retard",
  PENDING: "en-attente",
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parsePaymentsParams(params: Params): PaymentsListState {
  const statusWord = one(params.statut);
  const status =
    (Object.entries(STATUS_WORDS).find(([, word]) => word === statusWord)?.[0] as PaymentStatusFilter | undefined) ??
    (PAYMENT_STATUS_FILTERS.includes(statusWord as PaymentStatusFilter) ? (statusWord as PaymentStatusFilter) : "ALL");
  const letter = one(params.lettre).toUpperCase();
  const page = Number.parseInt(one(params.page), 10);
  return {
    filters: {
      query: one(params.q).slice(0, 100),
      classId: one(params.classe) || "ALL",
      status,
      method: one(params.mode) || "ALL",
      from: DAY.test(one(params.du)) ? one(params.du) : "",
      to: DAY.test(one(params.au)) ? one(params.au) : "",
    },
    letter: LETTERS.includes(letter) ? letter : null,
    family: one(params.famille) || null,
    page: Number.isFinite(page) && page > 1 ? page : 1,
  };
}

/** L'adresse d'un état de la liste (sans « ? ») ; les valeurs par défaut sont omises. */
export function paymentsParamsOf(state: PaymentsListState): string {
  const p = new URLSearchParams();
  const { filters } = state;
  if (filters.query.trim()) p.set("q", filters.query.trim());
  if (filters.classId !== "ALL") p.set("classe", filters.classId);
  if (filters.status !== "ALL") p.set("statut", STATUS_WORDS[filters.status]);
  if (filters.method !== "ALL") p.set("mode", filters.method);
  if (filters.from) p.set("du", filters.from);
  if (filters.to) p.set("au", filters.to);
  if (state.letter) p.set("lettre", state.letter);
  if (state.family) p.set("famille", state.family);
  if (state.page > 1) p.set("page", String(state.page));
  return p.toString();
}

type ListRow = FeeListItem & { parent: (FeeListItem["parent"] & { id: string }) | null };

/** Toutes les lignes qui passent les filtres, dans l'ordre reçu. */
export function filterPayments<T extends ListRow>(rows: T[], state: Omit<PaymentsListState, "page">): T[] {
  return rows.filter(
    (f) =>
      matchesFeeFilters(f, state.filters) &&
      matchesLetter(`${f.student.firstName} ${f.student.lastName}`, state.letter) &&
      (!state.family || f.parent?.id === state.family),
  );
}

/** La page demandée (ramenée à la dernière s'il y en a moins), et le total filtré. */
export function paginatePayments<T extends ListRow>(rows: T[], state: PaymentsListState) {
  const filtered = filterPayments(rows, state);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAYMENTS_PAGE_SIZE));
  const page = Math.min(state.page, pageCount);
  return {
    rows: filtered.slice((page - 1) * PAYMENTS_PAGE_SIZE, page * PAYMENTS_PAGE_SIZE),
    total: filtered.length,
    page,
    pageCount,
  };
}
