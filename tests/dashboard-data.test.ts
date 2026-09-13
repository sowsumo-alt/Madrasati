import { test } from "node:test";
import assert from "node:assert/strict";

import {
  lastMonthKeys,
  monthlySums,
  percentChange,
  runningTotals,
  scheduleDay,
  startOfWeek,
  topWithOthers,
  weeklyAttendance,
} from "../src/lib/dashboard-data";

/**
 * Les chiffres du tableau de bord sont la première chose que lit le directeur
 * chaque matin : ces règles de calcul ne doivent pas changer sans qu'on le voie.
 */

const d = (iso: string) => new Date(iso);

test("la semaine commence le lundi, même consultée un dimanche", () => {
  assert.equal(startOfWeek(d("2026-09-13T10:00:00Z")).toISOString(), "2026-09-07T00:00:00.000Z");
  assert.equal(startOfWeek(d("2026-09-07T08:00:00Z")).toISOString(), "2026-09-07T00:00:00.000Z");
});

test("un jour sans appel est omis, pas compté à zéro", () => {
  const records = [
    { date: d("2026-09-07T00:00:00Z"), status: "PRESENT" },
    { date: d("2026-09-07T00:00:00Z"), status: "ABSENT" },
    { date: d("2026-09-09T00:00:00Z"), status: "LATE" },
  ];
  assert.deepEqual(weeklyAttendance(records, d("2026-09-07T00:00:00Z")), [
    { dayIndex: 0, rate: 50 },
    { dayIndex: 2, rate: 100 },
  ]);
});

test("l'effectif suit les arrivées cumulées, mois après mois", () => {
  const months = lastMonthKeys(d("2026-09-13T00:00:00Z"), 3);
  assert.deepEqual(months, [
    { year: 2026, month: 6 },
    { year: 2026, month: 7 },
    { year: 2026, month: 8 },
  ]);
  const created = [d("2026-06-20T00:00:00Z"), d("2026-08-02T00:00:00Z"), d("2026-09-01T00:00:00Z")];
  assert.deepEqual(runningTotals(created, months), [1, 2, 3]);
});

test("l'argent perçu est additionné dans le mois où il est encaissé", () => {
  const months = lastMonthKeys(d("2026-09-13T00:00:00Z"), 2);
  const entries = [
    { at: d("2026-08-31T23:30:00Z"), amount: 1000 },
    { at: d("2026-09-01T00:10:00Z"), amount: 2500 },
    { at: d("2026-09-12T09:00:00Z"), amount: 500 },
  ];
  assert.deepEqual(monthlySums(entries, months), [1000, 3000]);
});

test("pas de pourcentage d'évolution sans mois de comparaison", () => {
  assert.equal(percentChange(3000, 0), null);
  assert.equal(percentChange(3000, 2000), 50);
  assert.equal(percentChange(1500, 2000), -25);
});

test("l'emploi du temps n'a pas de créneau le week-end", () => {
  assert.equal(scheduleDay(d("2026-09-07T08:00:00Z")), 1);
  assert.equal(scheduleDay(d("2026-09-11T08:00:00Z")), 5);
  assert.equal(scheduleDay(d("2026-09-12T08:00:00Z")), null);
  assert.equal(scheduleDay(d("2026-09-13T08:00:00Z")), null);
});

test("au-delà des couleurs disponibles, les petites parts sont regroupées", () => {
  const data = [
    { label: "1AS", value: 30 },
    { label: "2AS", value: 28 },
    { label: "3AS", value: 5 },
    { label: "4AS", value: 3 },
    { label: "5AS", value: 0 },
  ];
  assert.deepEqual(topWithOthers(data, 3, "Autres"), [
    { label: "1AS", value: 30 },
    { label: "2AS", value: 28 },
    { label: "Autres", value: 8 },
  ]);
  assert.deepEqual(topWithOthers(data.slice(0, 2), 3, "Autres"), data.slice(0, 2));
});
