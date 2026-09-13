import { test } from "node:test";
import assert from "node:assert/strict";

import { addWeeks, isoWeekday, monthCells, schoolDays, timeRows } from "../src/lib/schedule";

/** La grille de l'emploi du temps doit épouser les horaires réels de l'école. */

test("les lignes de la grille sont les plages distinctes, dans l'ordre de la journée", () => {
  const rows = timeRows([
    { startMinutes: 630, endMinutes: 690 },
    { startMinutes: 480, endMinutes: 540 },
    { startMinutes: 480, endMinutes: 540 },
    { startMinutes: 840, endMinutes: 900 },
  ]);
  assert.deepEqual(rows, [
    { startMinutes: 480, endMinutes: 540 },
    { startMinutes: 630, endMinutes: 690 },
    { startMinutes: 840, endMinutes: 900 },
  ]);
});

test("une semaine de classe va du lundi au vendredi", () => {
  const days = schoolDays(new Date("2026-09-14T00:00:00Z"));
  assert.equal(days.length, 5);
  assert.equal(days[0].toISOString().slice(0, 10), "2026-09-14");
  assert.equal(days[4].toISOString().slice(0, 10), "2026-09-18");
  assert.equal(addWeeks(new Date("2026-09-14T00:00:00Z"), -1).toISOString().slice(0, 10), "2026-09-07");
});

test("le dimanche est le septième jour, comme dans la saisie des créneaux", () => {
  assert.equal(isoWeekday(new Date("2026-09-14T08:00:00Z")), 1);
  assert.equal(isoWeekday(new Date("2026-09-20T08:00:00Z")), 7);
});

test("le calendrier du mois commence le lundi et se complète par semaines entières", () => {
  const cells = monthCells(2026, 8); // septembre 2026 : commence un mardi
  assert.equal(cells.length % 7, 0);
  assert.equal(cells[0].date.toISOString().slice(0, 10), "2026-08-31");
  assert.equal(cells[0].inMonth, false);
  assert.equal(cells[1].date.toISOString().slice(0, 10), "2026-09-01");
  assert.equal(cells.filter((c) => c.inMonth).length, 30);
});
