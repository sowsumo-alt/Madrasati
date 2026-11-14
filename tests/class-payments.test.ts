import { test } from "node:test";
import assert from "node:assert/strict";

import { classPaymentRows, feeCoversMonth, monthStatusOf, monthWindow } from "../src/lib/class-payments";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const NOW = d("2026-11-13");
const fee = (amount: number, paid: number, due = "2026-11-05") => ({ amount, paid, dueDate: d(due) });
const student = (firstName: string, fees: ReturnType<typeof fee>[], family: null | { holder: string; holderClass: string | null; fees: ReturnType<typeof fee>[] } = null) => ({
  id: firstName,
  firstName,
  lastName: "Ba",
  matricule: null,
  fees,
  family,
});

test("statut du mois : payé, partiel, en retard, à venir, pas de frais", () => {
  assert.equal(monthStatusOf([fee(1500, 1500)], NOW), "PAID");
  assert.equal(monthStatusOf([fee(1500, 500)], NOW), "PARTIAL");
  assert.equal(monthStatusOf([fee(1500, 0)], NOW), "OVERDUE");
  assert.equal(monthStatusOf([fee(1500, 0, "2026-11-30")], NOW), "PENDING");
  assert.equal(monthStatusOf([], NOW), "NO_FEE");
});

test("une classe : montants tels que saisis, totaux et comptes par statut", () => {
  const { rows, totals } = classPaymentRows(
    [student("Awa", [fee(1500, 1500)]), student("Moussa", [fee(1500, 500)]), student("Sidi", [fee(1500, 0)]), student("Zeinab", [])],
    NOW,
  );
  assert.deepEqual(rows.map((r) => r.status), ["PAID", "PARTIAL", "OVERDUE", "NO_FEE"]);
  assert.deepEqual(
    { expected: totals.expected, collected: totals.collected, remaining: totals.remaining },
    { expected: 4500, collected: 2000, remaining: 2500 },
  );
  assert.equal(totals.count.PAID, 1);
  assert.equal(totals.count.NO_FEE, 1);
});

test("fiche familiale : le statut de la fiche, mais l'argent compté une seule fois", () => {
  const familyFees = [fee(3000, 3000)];
  const { rows, totals } = classPaymentRows(
    [student("Aicha", familyFees), student("Brahim", [], { holder: "Aicha Ba", holderClass: "6AF", fees: familyFees })],
    NOW,
  );
  assert.equal(rows[1].status, "PAID");
  assert.deepEqual(rows[1].family, { holder: "Aicha Ba", holderClass: "6AF" });
  assert.equal(rows[1].amount, 0);
  assert.equal(totals.expected, 3000);
  assert.equal(totals.collected, 3000);
});

test("un trimestre payé d'avance couvre chacun de ses mois ; un frais à la main, le mois de son échéance", () => {
  const nov = monthWindow("2026-11")!;
  const quarter = { periodStart: d("2026-10-01"), periodEnd: d("2026-12-01"), dueDate: d("2026-10-01") };
  assert.equal(feeCoversMonth(quarter, nov), true);
  assert.equal(feeCoversMonth(quarter, monthWindow("2027-01")!), false);
  assert.equal(feeCoversMonth({ periodStart: d("2026-11-01"), periodEnd: null, dueDate: d("2026-11-01") }, nov), true);
  assert.equal(feeCoversMonth({ periodStart: null, periodEnd: null, dueDate: d("2026-11-20") }, nov), true);
  assert.equal(feeCoversMonth({ periodStart: null, periodEnd: null, dueDate: d("2026-12-01") }, nov), false);
  assert.equal(monthWindow("2026-13"), null);
  assert.equal(monthWindow("nov"), null);
});
