import { test } from "node:test";
import assert from "node:assert/strict";

import { receiptRank, receiptStanding, type StandingFee } from "../src/lib/receipt-status";

// La famille Sall (IBDAA 2, reçu REC-2026-0011) : fiche familiale à 1 600 MRU
// par mois, inscription 400 ; le 05/10/2026, la famille verse l'inscription
// et juin d'avance. Octobre est échu depuis le 1er octobre et pas encore réglé.
const at = new Date("2026-10-05T12:00:00Z");
const month = (m: number, y: number) => new Date(Date.UTC(y, m - 1, 1));
function family(junePaid = 1600, octoberPayments: StandingFee["payments"] = []): StandingFee[] {
  const months: StandingFee[] = [10, 11, 12, 1, 2, 3, 4, 5, 6].map((m) => ({
    id: `m${m}`,
    amount: 1600,
    dueDate: month(m, m >= 10 ? 2026 : 2027),
    payments: [],
  }));
  months.find((f) => f.id === "m10")!.payments = octoberPayments;
  months.find((f) => f.id === "m6")!.payments = [{ amount: junePaid, paidAt: at, receiptNumber: "REC-2026-0011-2" }];
  return [
    { id: "ins", amount: 400, dueDate: at, payments: [{ amount: 400, paidAt: at, receiptNumber: "REC-2026-0011-1" }] },
    ...months,
  ];
}
const receipt = { receiptFeeIds: ["ins", "m6"], paidAt: at, receiptNumber: "REC-2026-0011" };

test("test 21 — REC-2026-0011 : lignes réglées mais octobre dû → « Reçu », reste dû 1 600", () => {
  assert.deepEqual(receiptStanding({ fees: family(), ...receipt }), { dueAfter: 1600, linesLeft: 0, stamp: "RECEIVED" });
});

test("famille à jour après ce paiement → « Payé », reste dû 0", () => {
  const october = [{ amount: 1600, paidAt: new Date("2026-10-02T12:00:00Z"), receiptNumber: "REC-2026-0009" }];
  assert.deepEqual(receiptStanding({ fees: family(1600, october), ...receipt }), { dueAfter: 0, linesLeft: 0, stamp: "PAID" });
});

test("une ligne du reçu pas soldée → « Paiement partiel »", () => {
  const standing = receiptStanding({ fees: family(1000), ...receipt });
  assert.equal(standing.stamp, "PARTIAL");
  assert.equal(standing.linesLeft, 600);
});

test("un ancien reçu ne change pas : un paiement daté d'après n'y compte pas", () => {
  const later = [{ amount: 1600, paidAt: new Date("2026-10-10T12:00:00Z"), receiptNumber: "REC-2026-0014" }];
  assert.equal(receiptStanding({ fees: family(1600, later), ...receipt }).stamp, "RECEIVED");
  // Le même instant : seuls les reçus de numéro inférieur ou égal comptent.
  const sameTime = [{ amount: 1600, paidAt: at, receiptNumber: "REC-2026-0012" }];
  assert.equal(receiptStanding({ fees: family(1600, sameTime), ...receipt }).dueAfter, 1600);
  assert.equal(receiptRank("REC-2026-0011-2"), 11);
});
