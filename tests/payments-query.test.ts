import { test } from "node:test";
import assert from "node:assert/strict";

import { paginatePayments, parsePaymentsParams, paymentsParamsOf, PAYMENTS_PAGE_SIZE } from "../src/lib/payments-query";

function fee(i: number, over: Partial<{ status: "PAID" | "PENDING" | "OVERDUE"; parentId: string; firstName: string }> = {}) {
  return {
    id: `f${i}`,
    label: `Frais ${i}`,
    dueDate: "2026-10-01T00:00:00.000Z",
    status: over.status ?? "PENDING",
    isDue: true,
    student: { firstName: over.firstName ?? `Eleve${i}`, lastName: "Diallo", classId: "c1" },
    parent: { id: over.parentId ?? `p${i}`, firstName: "Parent", lastName: "Diallo", phone: "22246000000" },
    payments: [] as { receiptNumber: string; method: string; paidAt: string }[],
  };
}

test("l'adresse garde les filtres et les relit à l'identique", () => {
  const state = parsePaymentsParams({ q: "Aminata", statut: "impayes", classe: "c1", mode: "CASH", du: "2026-10-01", au: "2026-10-31", lettre: "a", famille: "p1", page: "3" });
  assert.deepEqual(state.filters, { query: "Aminata", classId: "c1", status: "UNPAID", method: "CASH", from: "2026-10-01", to: "2026-10-31" });
  assert.equal(state.letter, "A");
  assert.equal(state.family, "p1");
  assert.equal(state.page, 3);
  assert.deepEqual(parsePaymentsParams(Object.fromEntries(new URLSearchParams(paymentsParamsOf(state)))), state);
  // Sans paramètre : tout, page 1 — et une adresse vide.
  const empty = parsePaymentsParams({});
  assert.equal(empty.filters.status, "ALL");
  assert.equal(paymentsParamsOf(empty), "");
  // Valeurs invalides ignorées.
  assert.equal(parsePaymentsParams({ du: "31/02/2026", page: "-4", lettre: "é" }).filters.from, "");
});

test("une grande école n'envoie que la page affichée, avec le bon total", () => {
  const rows = Array.from({ length: 5400 }, (_, i) => fee(i, { status: i % 2 ? "PAID" : "PENDING" }));
  const all = paginatePayments(rows, parsePaymentsParams({}));
  assert.equal(all.rows.length, PAYMENTS_PAGE_SIZE);
  assert.equal(all.total, 5400);
  assert.equal(all.pageCount, 540);

  const unpaid = paginatePayments(rows, parsePaymentsParams({ statut: "impayes", page: "2" }));
  assert.equal(unpaid.total, 2700);
  assert.deepEqual(unpaid.rows.map((r) => r.id).slice(0, 2), ["f20", "f22"]);
});

test("famille, lettre et page trop loin", () => {
  const rows = [fee(1, { parentId: "pX", firstName: "Zeinab" }), fee(2, { parentId: "pX" }), fee(3)];
  assert.deepEqual(paginatePayments(rows, parsePaymentsParams({ famille: "pX" })).rows.map((r) => r.id), ["f1", "f2"]);
  assert.deepEqual(paginatePayments(rows, parsePaymentsParams({ lettre: "Z" })).rows.map((r) => r.id), ["f1"]);
  const far = paginatePayments(rows, parsePaymentsParams({ page: "99" }));
  assert.equal(far.page, 1);
  assert.equal(far.rows.length, 3);
});
