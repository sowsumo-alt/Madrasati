import { test } from "node:test";
import assert from "node:assert/strict";

import { familyReceiptLines, mergedPeriods, studentReceiptLines, type ReceiptPart } from "../src/lib/receipt-lines";

const m = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1));
const part = (studentId: string, label: string, amount: number, month?: [number, number]): ReceiptPart => ({
  studentId,
  studentLabel: studentId === "a" ? "Bompi Come — 1AF" : "Aliopm Come — 6AF",
  feeLabel: label,
  amount,
  periodStart: month ? m(...month) : null,
  periodEnd: month ? m(...month) : null,
});

// Le reçu de la capture : deux enfants, inscription + octobre, novembre et juin.
const parts = [
  part("a", "Frais d'inscription — 2026-2027", 400),
  part("a", "Frais de scolarité — Octobre 2026", 1600, [2026, 10]),
  part("a", "Frais de scolarité — Novembre 2026", 1600, [2026, 11]),
  part("a", "Frais de scolarité — Juin 2027", 1600, [2027, 6]),
  part("b", "Frais d'inscription — 2026-2027", 100, undefined),
  part("b", "Frais de scolarité — Octobre 2026", 1600, [2026, 10]),
];

test("les mois qui se suivent forment une seule période", () => {
  assert.equal(
    mergedPeriods([
      { start: m(2026, 10), end: m(2026, 10) },
      { start: m(2026, 11), end: m(2026, 11) },
      { start: m(2027, 6), end: m(2027, 6) },
    ]),
    "octobre à novembre 2026, juin 2027",
  );
  assert.equal(mergedPeriods([{ start: m(2026, 10), end: m(2027, 6) }]), "octobre 2026 à juin 2027");
});

test("reçu familial : une ligne par enfant, au lieu d'une par mois", () => {
  const lines = familyReceiptLines(parts);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0], {
    label: "Bompi Come — 1AF",
    detail: "Inscription · Scolarité : octobre à novembre 2026, juin 2027",
    amount: 5200,
  });
  assert.equal(lines[1].detail, "Inscription · Scolarité : octobre 2026");
  assert.equal(lines[1].amount, 1700);
});

test("reçu d'un élève : l'inscription, puis tous ses mois sur une ligne", () => {
  const lines = studentReceiptLines(parts.filter((p) => p.studentId === "a"));
  assert.deepEqual(lines, [
    { label: "Frais d'inscription — 2026-2027", detail: null, amount: 400 },
    { label: "Frais de scolarité", detail: "octobre à novembre 2026, juin 2027", amount: 4800 },
  ]);
});
