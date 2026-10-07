import { test } from "node:test";
import assert from "node:assert/strict";

import { lastMonths, percentChange, relativeTime, revenuePeriod, schoolCode } from "../src/lib/super-admin-stats";

const now = new Date(2026, 9, 7, 10, 0); // 7 octobre 2026

test("les 6 derniers mois, du plus ancien au plus récent", () => {
  assert.deepEqual(lastMonths(now, 6).map((m) => m.label), ["Mai", "Juin", "Juil", "Août", "Sep", "Oct"]);
});

test("revenus d'une période et évolution par rapport à la période précédente", () => {
  const payments = [
    { paidAt: new Date(2026, 9, 2), amount: 2135 }, // octobre
    { paidAt: new Date(2026, 7, 10), amount: 1000 }, // août
    { paidAt: new Date(2026, 2, 5), amount: 1000 }, // mars : période précédente
    { paidAt: new Date(2025, 0, 5), amount: 9999 }, // hors des 12 mois
  ];
  const period = revenuePeriod(payments, now, 6);
  assert.equal(period.points.length, 6);
  assert.equal(period.points[5].value, 2135);
  assert.equal(period.total, 3135);
  assert.equal(period.previousTotal, 1000);
  assert.equal(period.change, 214);
  // Rien avant : pas de pourcentage inventé.
  assert.equal(revenuePeriod(payments.slice(0, 2), now, 6).change, null);
});

test("pourcentage et dates relatives", () => {
  assert.equal(percentChange(112, 100), 12);
  assert.equal(percentChange(5, 0), null);
  assert.equal(relativeTime(new Date(now.getTime() - 30_000), now), "à l'instant");
  assert.equal(relativeTime(new Date(now.getTime() - 2 * 3600_000), now), "il y a 2 h");
  assert.equal(relativeTime(new Date(now.getTime() - 3 * 86_400_000), now), "il y a 3 j");
  assert.equal(schoolCode(1), "#E001");
  assert.equal(schoolCode(42), "#E042");
});
