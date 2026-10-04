import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildInstallments,
  coveredMonths,
  monthsBetween,
  periodLabel,
  periodMonthsOf,
  prepaidShare,
} from "../src/lib/tuition";

const m = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1));
// Année scolaire d'octobre 2026 à juin 2027 : 9 mois facturés.
const year = monthsBetween(m(2026, 10), m(2027, 6));

test("les mois facturés de l'année, du premier au dernier inclus", () => {
  assert.equal(year.length, 9);
  assert.equal(periodMonthsOf("MONTHLY", 0, 9), 1);
  assert.equal(periodMonthsOf("QUARTERLY", 0, 9), 3);
  assert.equal(periodMonthsOf("ANNUAL", 0, 9), 9);
  assert.equal(periodMonthsOf("CUSTOM", 4, 9), 4);
  assert.equal(periodMonthsOf("CUSTOM", 40, 9), 9); // jamais plus que l'année
});

test("formule « 4 mois » : une échéance de 20 000 MRU pour 4 mois à 5 000", () => {
  const list = buildInstallments({
    months: year,
    periodMonths: 4,
    monthlyAmount: 5000,
    frequency: "CUSTOM",
    yearFirstMonth: year[0],
  });
  assert.deepEqual(
    list.map((i) => [i.label, i.amount, i.months]),
    [
      ["Frais de scolarité — Octobre 2026 à janvier 2027 (4 mois)", 20000, 4],
      ["Frais de scolarité — Février à mai 2027 (4 mois)", 20000, 4],
      ["Frais de scolarité — Juin 2027 (1 mois)", 5000, 1],
    ],
  );
  assert.equal(list[0].dueDate.toISOString().slice(0, 10), "2026-10-01");
});

test("mensuel : une échéance par mois ; trimestriel : 15 000 tous les 3 mois", () => {
  const monthly = buildInstallments({ months: year, periodMonths: 1, monthlyAmount: 5000, frequency: "MONTHLY", yearFirstMonth: year[0] });
  assert.equal(monthly.length, 9);
  assert.equal(monthly[0].label, "Frais de scolarité — Octobre 2026");
  assert.ok(monthly.every((i) => i.amount === 5000));

  const quarterly = buildInstallments({ months: year, periodMonths: 3, monthlyAmount: 5000, frequency: "QUARTERLY", yearFirstMonth: year[0] });
  assert.deepEqual(
    quarterly.map((i) => [i.label, i.amount]),
    [
      ["Frais de scolarité — Trimestre 1 (octobre à décembre 2026)", 15000],
      ["Frais de scolarité — Trimestre 2 (janvier à mars 2027)", 15000],
      ["Frais de scolarité — Trimestre 3 (avril à juin 2027)", 15000],
    ],
  );
});

test("changer de formule en cours d'année : les mois déjà payés ne sont jamais refacturés", () => {
  // Octobre et novembre payés au mois ; le parent règle ensuite le reste de l'année en une fois.
  const paid = [
    { periodStart: m(2026, 10), periodEnd: m(2026, 10) },
    { periodStart: m(2026, 11), periodEnd: m(2026, 11) },
  ];
  const covered = coveredMonths(paid);
  const remaining = year.filter((month) => !covered.has(month.getTime()));
  const list = buildInstallments({
    months: remaining,
    periodMonths: 9,
    monthlyAmount: 5000,
    frequency: "ANNUAL",
    yearFirstMonth: year[0],
    yearLabel: "2026-2027",
  });
  assert.deepEqual(
    list.map((i) => [i.label, i.amount]),
    [["Frais de scolarité — Année 2026-2027 (décembre 2026 à juin 2027)", 35000]],
  );
});

test("un mois déjà payé au milieu coupe la période", () => {
  const covered = coveredMonths([{ periodStart: m(2027, 1), periodEnd: m(2027, 1) }]);
  const list = buildInstallments({
    months: year.filter((month) => !covered.has(month.getTime())),
    periodMonths: 3,
    monthlyAmount: 5000,
    frequency: "QUARTERLY",
    yearFirstMonth: year[0],
  });
  assert.ok(list.every((i) => i.periodStart.getTime() !== m(2027, 1).getTime()));
  assert.equal(list.reduce((sum, i) => sum + i.amount, 0), 8 * 5000);
  assert.equal(periodLabel(m(2026, 10), m(2026, 12)), "octobre à décembre 2026");
});

test("mois déjà payés avant Madrasati : 1 mois en mensuel, 4 mois en une fois, trimestre entamé", () => {
  // Mensuel à 600 : payé jusqu'en octobre → octobre réglé, novembre non.
  const monthly = buildInstallments({ months: year, periodMonths: 1, monthlyAmount: 600, frequency: "MONTHLY", yearFirstMonth: year[0] });
  assert.deepEqual(monthly.slice(0, 2).map((i) => prepaidShare(i, m(2026, 10), 600)), [600, 0]);
  // 4 mois en une fois à 800 : les 4 premiers mois payés → la 1re échéance soldée.
  const four = buildInstallments({ months: year, periodMonths: 4, monthlyAmount: 800, frequency: "CUSTOM", yearFirstMonth: year[0] });
  assert.equal(four[0].amount, 3200);
  assert.deepEqual(four.map((i) => prepaidShare(i, m(2027, 1), 800)), [3200, 0, 0]);
  // Trimestriel : un seul mois payé → un tiers du trimestre, le reste dû.
  const quarter = buildInstallments({ months: year, periodMonths: 3, monthlyAmount: 5000, frequency: "QUARTERLY", yearFirstMonth: year[0] });
  assert.equal(prepaidShare(quarter[0], m(2026, 10), 5000), 5000);
});
