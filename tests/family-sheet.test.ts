import { test } from "node:test";
import assert from "node:assert/strict";

import { sheetErrors, sheetLines, sheetTotals, type FamilySheetInput } from "../src/lib/family-sheet";
import { balanceOf, formatMoney, fromMru, toMru } from "../src/lib/money";
import { newSheetDraft, sheetDraftToInput } from "../src/lib/family-sheet-draft";

const m = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1)).toISOString();
const sheet = (monthly: number, enrollment: number, months: string[], paidOf?: (month: string) => number): FamilySheetInput => ({
  referentIndex: 0,
  monthly,
  enrollment: { due: enrollment, paid: enrollment },
  months: months.map((month) => ({ month, paid: paidOf ? paidOf(month) : monthly })),
});
const totalOf = (input: FamilySheetInput) => sheetTotals(sheetLines(input));

// Test 1 — fiche réelle 028 : 13 000 MRO par mois, inscription 4 000 MRO,
// 2 élèves, 7 mois versés (octobre → mars, et juin d'avance).
test("fiche 028 : 7 mois × 1 300 + inscription 400 = 9 500 MRU, pas 18 600", () => {
  const monthly = toMru("13000", "MRO").mru;
  const enrollment = toMru("4000", "MRO").mru;
  assert.equal(monthly, 1300);
  assert.equal(enrollment, 400);
  const months = [m(2026, 10), m(2026, 11), m(2026, 12), m(2027, 1), m(2027, 2), m(2027, 3), m(2027, 6)];
  const lines = sheetLines(sheet(monthly, enrollment, months));
  const tuition = lines.filter((l) => l.kind === "MONTH").reduce((s, l) => s + l.paid, 0);
  assert.equal(tuition, 9100);
  assert.deepEqual(sheetTotals(lines), { paid: 9500, balance: 0 });
  assert.equal(lines.length, 8); // une ligne par mois, une pour l'inscription — rien par enfant
});

// Test 2 — fiche réelle 031 : 24 000 MRO par mois, inscription 4 000 MRO, juin le jour de l'inscription.
test("fiche 031 : juin 2 400 + inscription 400 = 2 800 MRU = 28 000 MRO, pas 5 200", () => {
  const input = sheet(toMru("24000", "MRO").mru, toMru("4000", "MRO").mru, [m(2027, 6)]);
  const { paid } = totalOf(input);
  assert.equal(paid, 2800);
  assert.equal(formatMoney(paid, "MRO").replace(/\s/g, " "), "28 000 MRO (2 800 MRU)");
});

// Test 3
test("mensuel 1 400, juin seulement, inscription 400 : 1 800 MRU, pas 3 200", () => {
  assert.equal(totalOf(sheet(1400, 400, [m(2027, 6)])).paid, 1800);
});

// Test 5
test("inscription 2 000 + juin 6 000 : premier paiement 8 000 ; l'inscription ne revient pas", () => {
  const first = sheetLines(sheet(6000, 2000, [m(2027, 6)]));
  assert.equal(sheetTotals(first).paid, 8000);
  assert.equal(first.filter((l) => l.kind === "ENROLLMENT").length, 1);
  // Un mois suivant, réglé seul : 6 000, sans inscription.
  const next = sheetLines({ referentIndex: 0, monthly: 6000, enrollment: { due: 0, paid: 0 }, months: [{ month: m(2026, 11), paid: 6000 }] });
  assert.equal(sheetTotals(next).paid, 6000);
  assert.ok(next.every((l) => l.kind === "MONTH"));
});

// Test 6
test("paiement partiel : dû 1 300, versé 800 → solde 500 sur ce mois", () => {
  const lines = sheetLines(sheet(1300, 0, [m(2026, 10)], () => 800));
  assert.deepEqual(
    lines.map((l) => [l.label, l.due, l.paid, l.balance]),
    [["Octobre 2026", 1300, 800, 500]],
  );
  assert.deepEqual(sheetTotals(lines), { paid: 800, balance: 500 });
});

// Test 7
test("MRO invalide (13 005) : refusé avec un message clair", () => {
  const result = toMru("13005", "MRO");
  assert.ok(result.error && /se termine par 0/.test(result.error));
  assert.equal(toMru("13000", "MRO").error, null);
  assert.equal(fromMru(1300, "MRO"), "13000");
});

test("on ne verse pas plus que le montant d'une ligne", () => {
  assert.equal(sheetErrors(sheet(1300, 400, [m(2026, 10)], () => 1500)).length, 1);
  assert.equal(sheetErrors(sheet(0, 400, [m(2026, 10)], () => 100)).length, 1);
  assert.deepEqual(sheetErrors(sheet(1300, 400, [m(2026, 10)])), []);
});

// Test 10 (règle) : un mois payé d'avance n'est jamais un impayé.
test("reste dû à ce jour : un mois payé d'avance ne compte pas, un mois à venir non plus", () => {
  const now = new Date("2026-10-15");
  const balance = balanceOf(
    [
      { amount: 1300, paid: 1300, dueDate: "2027-06-01" }, // juin payé d'avance
      { amount: 1300, paid: 0, dueDate: "2026-10-01" }, // octobre, échu, non payé
      { amount: 1300, paid: 0, dueDate: "2026-11-01" }, // novembre, à venir
      { amount: 400, paid: 400, dueDate: "2026-10-05" }, // inscription
    ],
    now,
  );
  assert.deepEqual(balance, { billed: 4300, paid: 1700, due: 1300, upcoming: 1300 });
});

// —— Saisie de la fiche (écran), en MRU ou en MRO ——

test("saisie en MRO comme sur la fiche papier : 13 000 / 4 000 → 1 300 / 400 MRU", () => {
  const months = [m(2026, 10), m(2026, 11), m(2027, 6)];
  const draft = newSheetDraft({ referentKey: "a", monthlyMru: null, unit: "MRO", prepaid: [m(2027, 6)] });
  draft.monthly = "13000";
  draft.enrollmentDue = "4000";
  draft.months[m(2026, 10)] = { checked: true, paid: "" };
  const { input, errors } = sheetDraftToInput(draft, { unit: "MRO", referentIndex: 0, months, today: "2026-10-05" });
  assert.deepEqual(errors, []);
  assert.equal(input.monthly, 1300);
  assert.deepEqual(input.enrollment, { due: 400, paid: 400, date: "2026-10-05" });
  assert.deepEqual(input.months.map((x) => x.paid), [1300, 1300]); // octobre et juin, au montant mensuel
  assert.equal(sheetTotals(sheetLines(input)).paid, 3000);
});

test("saisie MRO invalide (13 005) : la fiche ne peut pas être enregistrée", () => {
  const draft = newSheetDraft({ referentKey: "a", monthlyMru: null, unit: "MRO", prepaid: [] });
  draft.monthly = "13005";
  const { errors } = sheetDraftToInput(draft, { unit: "MRO", referentIndex: 0, months: [] });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Montant mensuel : 13.005 MRO/);
});

// Test 4 — inscription solo : la même fiche, à un seul élève, le même calcul.
test("inscription solo : 3 × 1 300 + inscription 200 = 4 100 MRU", () => {
  const months = [m(2026, 10), m(2026, 11), m(2026, 12), m(2027, 1)];
  const draft = newSheetDraft({ referentKey: "solo", monthlyMru: 1300, unit: "MRU", prepaid: [] });
  draft.enrollmentDue = "200";
  for (const month of months.slice(0, 3)) draft.months[month] = { checked: true, paid: "" };
  const { input, errors } = sheetDraftToInput(draft, { unit: "MRU", referentIndex: 0, months, today: "2026-10-05" });
  assert.deepEqual(errors, []);
  const lines = sheetLines(input);
  assert.deepEqual(lines.map((l) => [l.label, l.paid]), [
    ["Octobre 2026", 1300],
    ["Novembre 2026", 1300],
    ["Décembre 2026", 1300],
    ["Frais d'inscription", 200],
  ]);
  assert.equal(sheetTotals(lines).paid, 4100);
});

// Test 15 — reprise de la fiche 028 : chaque mois à la date recopiée (30/09/2026).
test("reprise fiche 028 : dates passées gardées, 9 500 MRU, avril et mai restent dus", () => {
  const months = [10, 11, 12, 1, 2, 3, 4, 5, 6].map((n) => m(n >= 10 ? 2026 : 2027, n));
  const draft = newSheetDraft({ referentKey: "a", monthlyMru: null, unit: "MRO", prepaid: [] });
  draft.monthly = "13000";
  draft.enrollmentDue = "4000";
  draft.enrollmentDate = "2026-09-30";
  for (const month of [...months.slice(0, 6), months[8]]) draft.months[month] = { checked: true, paid: "", date: "2026-09-30" };
  const { input, errors } = sheetDraftToInput(draft, { unit: "MRO", referentIndex: 0, months, today: "2026-10-05" });
  assert.deepEqual(errors, []);
  const lines = sheetLines(input);
  assert.equal(sheetTotals(lines).paid, 9500);
  assert.ok(lines.every((l) => l.date === "2026-09-30"));
  assert.ok(!lines.some((l) => l.month === m(2027, 4) || l.month === m(2027, 5)));
});

// Test 16 — fiche 031, juin payé le 05/10/2026.
test("fiche 031 avec juin au 05/10/2026 : 2 800 MRU à cette date", () => {
  const months = [m(2026, 10), m(2027, 6)];
  const draft = newSheetDraft({ referentKey: "a", monthlyMru: null, unit: "MRO", prepaid: [] });
  draft.monthly = "24000";
  draft.enrollmentDue = "4000";
  draft.enrollmentDate = "2026-10-05";
  draft.months[m(2027, 6)] = { checked: true, paid: "", date: "2026-10-05" };
  const { input, errors } = sheetDraftToInput(draft, { unit: "MRO", referentIndex: 0, months, today: "2026-10-07" });
  assert.deepEqual(errors, []);
  const lines = sheetLines(input);
  assert.equal(sheetTotals(lines).paid, 2800);
  assert.deepEqual([...new Set(lines.map((l) => l.date))], ["2026-10-05"]);
});

test("une date à venir est refusée ; une date passée est acceptée", () => {
  const base = sheet(1300, 0, [m(2026, 10)]);
  assert.deepEqual(sheetErrors({ ...base, months: [{ month: m(2026, 10), paid: 1300, date: "2026-09-30" }] }, "2026-10-05"), []);
  const future = sheetErrors({ ...base, months: [{ month: m(2026, 10), paid: 1300, date: "2026-10-20" }] }, "2026-10-05");
  assert.equal(future.length, 1);
  assert.match(future[0], /20\/10\/2026 n'est pas encore arrivée/);
});

test("fiche déjà saisie : le reste dû d'un mois en partie payé, l'inscription jamais refacturée", () => {
  const already = { months: { [m(2026, 10)]: { due: 1300, paid: 800 } }, enrollment: { due: 400, paid: 400 } };
  const months = [m(2026, 10), m(2026, 11)];
  const draft = newSheetDraft({ referentKey: "a", monthlyMru: 1300, unit: "MRU", prepaid: [], enrollmentDueMru: 400 });
  draft.months[m(2026, 10)] = { checked: true, paid: "" };
  const { input, errors } = sheetDraftToInput(draft, { unit: "MRU", referentIndex: 0, months, already, today: "2026-10-05" });
  assert.deepEqual(errors, []);
  const lines = sheetLines(input);
  // Octobre : le reste (500), et rien pour l'inscription déjà réglée.
  assert.deepEqual(lines.map((l) => [l.label, l.before, l.paid, l.balance]), [["Octobre 2026", 800, 500, 0]]);
  // Verser 600 sur ce reste de 500 : refusé.
  draft.months[m(2026, 10)] = { checked: true, paid: "600" };
  assert.equal(sheetDraftToInput(draft, { unit: "MRU", referentIndex: 0, months, already, today: "2026-10-05" }).errors.length, 1);
});
