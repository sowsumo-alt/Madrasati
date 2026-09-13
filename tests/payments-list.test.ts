import { test } from "node:test";
import assert from "node:assert/strict";

import {
  collectionRate,
  daysOverdue,
  feeListDay,
  matchesFeeFilters,
  type FeeListFilters,
  type FeeListItem,
} from "../src/lib/payments-list";

/** La liste des paiements doit retrouver un frais par l'élève, le parent ou le reçu. */

const fee = (over: Partial<FeeListItem> = {}): FeeListItem => ({
  label: "Frais de scolarité",
  dueDate: "2026-09-30T00:00:00.000Z",
  status: "PENDING",
  student: { firstName: "Aïcha", lastName: "Mint Brahim", classId: "c1" },
  parent: { firstName: "Brahim", lastName: "Ould Mohamed", phone: "+22222000000" },
  payments: [],
  ...over,
});

const ALL: FeeListFilters = { query: "", classId: "ALL", status: "ALL", method: "ALL", from: "", to: "" };

test("la date d'une ligne est celle du dernier paiement, sinon l'échéance", () => {
  assert.equal(feeListDay(fee()), "2026-09-30");
  const paidTwice = fee({
    payments: [
      { receiptNumber: "REC-1", method: "CASH", paidAt: "2026-09-02T10:00:00.000Z" },
      { receiptNumber: "REC-2", method: "SEDAD", paidAt: "2026-09-15T10:00:00.000Z" },
    ],
  });
  assert.equal(feeListDay(paidTwice), "2026-09-15");
});

test("« Non réglés » garde tout ce qui n'est pas soldé", () => {
  const unpaid = { ...ALL, status: "UNPAID" as const };
  assert.equal(matchesFeeFilters(fee({ status: "PARTIAL" }), unpaid), true);
  assert.equal(matchesFeeFilters(fee({ status: "OVERDUE" }), unpaid), true);
  assert.equal(matchesFeeFilters(fee({ status: "PAID" }), unpaid), false);
  assert.equal(matchesFeeFilters(fee({ status: "PAID" }), { ...ALL, status: "PAID" }), true);
});

test("la recherche ignore accents et majuscules, et trouve un reçu ou le parent", () => {
  const paid = fee({
    payments: [{ receiptNumber: "REC-2026-0042", method: "CASH", paidAt: "2026-09-02T10:00:00.000Z" }],
  });
  assert.equal(matchesFeeFilters(paid, { ...ALL, query: "aicha" }), true);
  assert.equal(matchesFeeFilters(paid, { ...ALL, query: "rec-2026-0042" }), true);
  assert.equal(matchesFeeFilters(paid, { ...ALL, query: "brahim mohamed" }), true);
  assert.equal(matchesFeeFilters(paid, { ...ALL, query: "sidi" }), false);
});

test("période incluse, classe, et mode « aucun paiement »", () => {
  assert.equal(matchesFeeFilters(fee(), { ...ALL, from: "2026-09-30", to: "2026-09-30" }), true);
  assert.equal(matchesFeeFilters(fee(), { ...ALL, to: "2026-09-29" }), false);
  assert.equal(matchesFeeFilters(fee(), { ...ALL, method: "NONE" }), true);
  assert.equal(matchesFeeFilters(fee(), { ...ALL, method: "CASH" }), false);
  assert.equal(matchesFeeFilters(fee(), { ...ALL, classId: "c2" }), false);
});

test("retard en jours civils, et recouvrement plafonné à 100 %", () => {
  const now = new Date("2026-10-03T08:00:00.000Z");
  assert.equal(daysOverdue({ amount: 1000, totalPaid: 0, dueDate: "2026-09-30T00:00:00.000Z" }, now), 3);
  assert.equal(daysOverdue({ amount: 1000, totalPaid: 1000, dueDate: "2026-09-30T00:00:00.000Z" }, now), 0);
  assert.equal(collectionRate(0, 0), null);
  assert.equal(collectionRate(30000, 20000), 67);
  assert.equal(collectionRate(10000, 12000), 100);
});
