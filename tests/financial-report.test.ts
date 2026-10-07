import { test } from "node:test";
import assert from "node:assert/strict";

import { buildFinancialReport, feeKind, receiptKey, type ReportFee } from "../src/lib/financial-report";

const now = new Date("2026-10-07T12:00:00Z");
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

// Famille Sall (2 enfants, fiche familiale portée par Tahra) et un élève seul.
const fees: ReportFee[] = [
  { studentId: "tahra", className: "3AF", label: "Frais d'inscription — 2026-2027", amount: 400, dueDate: d("2026-10-05"), paid: 400 },
  { studentId: "tahra", className: "3AF", label: "Frais de scolarité — Octobre 2026", amount: 1600, dueDate: d("2026-10-01"), paid: 0 },
  { studentId: "tahra", className: "3AF", label: "Frais de scolarité — Juin 2027", amount: 1600, dueDate: d("2027-06-01"), paid: 1600 },
  { studentId: "hadrami", className: "3AF", label: "Tenue scolaire", amount: 300, dueDate: d("2026-10-02"), paid: 100 },
  { studentId: "awa", className: "CP", label: "Frais de scolarité — Octobre 2026", amount: 1000, dueDate: d("2026-10-01"), paid: 1000 },
];
const groupOf = (id: string) =>
  id === "awa" ? { key: "awa", label: "Awa Ba", href: "/eleve" } : { key: "sall", label: "Famille Sall", href: "/famille" };

const report = buildFinancialReport({
  fees,
  payments: [
    { amount: 400, method: "CASH", paidAt: d("2026-10-05") },
    { amount: 1600, method: "CASH", paidAt: d("2026-10-05") },
    { amount: 100, method: "MASRVI", paidAt: d("2026-10-06") },
    { amount: 1000, method: "SEDAD", paidAt: d("2026-10-03") },
  ],
  cancelled: [{ amount: 500 }],
  receiptKeys: ["REC-2026-0011", "REC-2026-0011", "REC-2026-0012", "REC-2026-0013"],
  groupOf,
  now,
});

test("totaux : la même règle que la page famille (reste dû à ce jour, à venir)", () => {
  assert.deepEqual(report.totals, { billed: 4900, paid: 3100, due: 1800, upcoming: 0 });
  assert.equal(report.collected, 3100);
  assert.equal(report.receipts, 3); // un reçu familial en deux parts compte une fois
  assert.deepEqual(report.cancelled, { count: 1, amount: 500 });
});

test("impayés par famille : la famille Sall une seule fois, pas une fois par enfant", () => {
  assert.deepEqual(report.topDebtors, [{ label: "Famille Sall", href: "/famille", due: 1800 }]);
});

test("par mode de paiement, par classe, par type de frais", () => {
  assert.deepEqual(report.byMethod.map((m) => [m.method, m.amount, m.share]), [
    ["CASH", 2000, 65],
    ["SEDAD", 1000, 32],
    ["MASRVI", 100, 3],
  ]);
  assert.deepEqual(report.byClass.map((c) => [c.label, c.billed, c.due]), [
    ["3AF", 3900, 1800],
    ["CP", 1000, 0],
  ]);
  assert.deepEqual(report.byKind.map((k) => k.label), ["Frais de scolarité", "Frais d'inscription", "Autres frais"]);
  assert.equal(feeKind("Frais de réinscription — 2026-2027"), "ENROLLMENT");
  assert.equal(receiptKey("REC-2026-0012-2"), "REC-2026-0012");
});
