import { test } from "node:test";
import assert from "node:assert/strict";

import { reductionsByPayment } from "../src/lib/payment-correction";

const d = (iso: string) => new Date(`${iso}T10:00:00Z`);

test("le trop-perçu est retiré du versement le plus récent (cas réel : 10 000 au lieu de 1 000)", () => {
  const cuts = reductionsByPayment(
    [{ feeId: "trimestre", target: 1000 }],
    [
      { id: "rec-0018", feeId: "trimestre", amount: 1000, paidAt: d("2026-09-18") },
      { id: "rec-0039", feeId: "trimestre", amount: 10000, paidAt: d("2026-10-01") },
    ],
  );
  assert.deepEqual([...cuts], [["rec-0039", 10000]]);
});

test("un mois coché par erreur : tout son versement est retiré, les autres frais ne bougent pas", () => {
  const cuts = reductionsByPayment(
    [{ feeId: "novembre", target: 0 }],
    [
      { id: "p1", feeId: "octobre", amount: 1000, paidAt: d("2026-10-02") },
      { id: "p2", feeId: "novembre", amount: 1000, paidAt: d("2026-10-02") },
    ],
  );
  assert.deepEqual([...cuts], [["p2", 1000]]);
});

test("un excédent plus grand que le dernier versement continue sur le précédent", () => {
  const cuts = reductionsByPayment(
    [{ feeId: "f", target: 500 }],
    [
      { id: "a", feeId: "f", amount: 1000, paidAt: d("2026-10-01") },
      { id: "b", feeId: "f", amount: 700, paidAt: d("2026-10-05") },
    ],
  );
  assert.deepEqual([...cuts], [["b", 700], ["a", 500]]);
});
