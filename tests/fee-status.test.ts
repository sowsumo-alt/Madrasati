import { test } from "node:test";
import assert from "node:assert/strict";

import { feeDisplayStatus, isLate, remainingOf } from "../src/lib/fee-status";

/**
 * Le retard écrasait le versement partiel : un frais de 15 000 MRU sur lequel
 * 1 000 venaient d'être encaissés continuait d'afficher « Impayé » et
 * « 15 000 MRU », strictement comme avant le paiement. Rien ne bougeait sur la
 * ligne, et l'encaissement passait pour perdu alors qu'il était enregistré.
 * Ces tests fixent la règle qui sépare les deux informations.
 */

const AUJOURDHUI = new Date("2026-08-24T12:00:00.000Z");
const ECHUE = "2025-10-15T00:00:00.000Z";
const A_VENIR = "2026-12-15T00:00:00.000Z";

const fee = (amount: number, totalPaid: number, dueDate: string) => ({
  amount,
  totalPaid,
  dueDate,
});

test("le cas signale : 1 000 encaisses sur 15 000, echeance passee", () => {
  const f = fee(15000, 1000, ECHUE);
  assert.equal(feeDisplayStatus(f, AUJOURDHUI), "PARTIAL", "le badge doit dire « Partiel », pas « Impayé »");
  assert.equal(remainingOf(f), 14000, "c'est 14 000 qu'il reste a percevoir");
  assert.equal(isLate(f, AUJOURDHUI), true, "et le retard reste signale a cote");
});

test("le solde ramene le frais a « Paye »", () => {
  const f = fee(15000, 15000, ECHUE);
  assert.equal(feeDisplayStatus(f, AUJOURDHUI), "PAID");
  assert.equal(remainingOf(f), 0);
  assert.equal(isLate(f, AUJOURDHUI), false, "un frais solde n'est plus en retard");
});

test("rien d'encaisse et echeance passee : « Impaye »", () => {
  const f = fee(15000, 0, ECHUE);
  assert.equal(feeDisplayStatus(f, AUJOURDHUI), "OVERDUE");
  assert.equal(isLate(f, AUJOURDHUI), true);
});

test("rien d'encaisse mais echeance a venir : « En attente »", () => {
  const f = fee(15000, 0, A_VENIR);
  assert.equal(feeDisplayStatus(f, AUJOURDHUI), "PENDING");
  assert.equal(isLate(f, AUJOURDHUI), false);
});

test("un versement partiel avant l'echeance est « Partiel », sans mention de retard", () => {
  const f = fee(15000, 1000, A_VENIR);
  assert.equal(feeDisplayStatus(f, AUJOURDHUI), "PARTIAL");
  assert.equal(isLate(f, AUJOURDHUI), false);
});

test("un trop-percu solde le frais et ne cree pas de dette negative", () => {
  const f = fee(7500, 9000, ECHUE);
  assert.equal(feeDisplayStatus(f, AUJOURDHUI), "PAID");
  assert.equal(remainingOf(f), 0, "le reste est borne a zero, jamais negatif");
});

test("plusieurs petits versements se cumulent avant de solder", () => {
  // Cas reel : 700 puis 50 sur 7 500. Tant que le total n'atteint pas le
  // montant, la ligne reste « Partiel ».
  assert.equal(feeDisplayStatus(fee(7500, 750, ECHUE), AUJOURDHUI), "PARTIAL");
  assert.equal(remainingOf(fee(7500, 750, ECHUE)), 6750);
});

test("le statut ne depend pas du champ enregistre en base, mais des montants", () => {
  // Si un statut stocke prenait du retard, la ligne resterait juste : elle est
  // deduite de ce qui a reellement ete encaisse.
  const f = { amount: 300, totalPaid: 300, dueDate: ECHUE, status: "PENDING" };
  assert.equal(feeDisplayStatus(f, AUJOURDHUI), "PAID");
});

test("un frais a zero est considere comme solde", () => {
  assert.equal(feeDisplayStatus(fee(0, 0, ECHUE), AUJOURDHUI), "PAID");
});
