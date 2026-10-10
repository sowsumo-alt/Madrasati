"use server";

import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { filterPayments, parsePaymentsParams } from "@/lib/payments-query";
import { loadPaymentsData, openFeesOf } from "./payments-data";
import type { FeeRow } from "./finance-view";

/**
 * Chargements à la demande de la liste des paiements : la page n'envoie que
 * les 10 lignes affichées ; le reste n'est demandé que pour un geste précis.
 */

/** Export PDF de toute la liste filtrée (mêmes filtres que l'adresse). */
export async function paymentRowsForExport(query: string): Promise<FeeRow[]> {
  const user = await requireRole(ROLES.DIRECTOR);
  const state = parsePaymentsParams(Object.fromEntries(new URLSearchParams(query)));
  const { rows } = await loadPaymentsData(user.schoolId);
  return filterPayments(rows, state);
}

/** Frais encore dus, pour « Enregistrer un paiement » : d'un élève, ou de toute l'école. */
export async function openFeesForPayment(studentId?: string): Promise<FeeRow[]> {
  const user = await requireRole(ROLES.DIRECTOR);
  const { rows } = await loadPaymentsData(user.schoolId);
  return openFeesOf(rows, studentId);
}
