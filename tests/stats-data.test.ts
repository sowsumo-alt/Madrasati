import { test } from "node:test";
import assert from "node:assert/strict";

import {
  levelDistribution,
  monthlyCounts,
  pointsChange,
  referenceDate,
  subjectAverages,
} from "../src/lib/stats-data";

/** Les statistiques doivent dire la même chose que les autres écrans. */

test("une année terminée se lit jusqu'à sa fin, une année en cours jusqu'à aujourd'hui", () => {
  const now = new Date("2026-09-15T10:00:00Z");
  const ended = new Date("2026-07-31T00:00:00Z");
  const running = new Date("2027-07-31T00:00:00Z");
  assert.equal(referenceDate(ended, now), ended);
  assert.equal(referenceDate(running, now), now);
});

test("les notes sont ramenées sur 20 avant d'en faire la moyenne", () => {
  const averages = subjectAverages([
    { score: 8, maxScore: 10, subject: "Mathématiques" },
    { score: 12, maxScore: 20, subject: "Mathématiques" },
    { score: 15, maxScore: 20, subject: "Arabe" },
  ]);
  assert.deepEqual(averages, [
    { label: "Arabe", value: 15 },
    { label: "Mathématiques", value: 14 },
  ]);
});

test("les niveaux sont additionnés et les niveaux vides écartés", () => {
  assert.deepEqual(
    levelDistribution([
      { level: "1AS", count: 3 },
      { level: "1AF", count: 4 },
      { level: "1AS", count: 0 },
      { level: "5AS", count: 0 },
    ]),
    [
      { label: "1AF", value: 4 },
      { label: "1AS", value: 3 },
    ],
  );
});

test("évolution de la présence en points, et comptes mois par mois", () => {
  assert.equal(pointsChange([{ rate: 90 }, { rate: 85 }]), -5);
  assert.equal(pointsChange([{ rate: 90 }]), null);
  const months = [
    { year: 2026, month: 7 },
    { year: 2026, month: 8 },
  ];
  const dates = [
    new Date("2026-08-02T08:00:00Z"),
    new Date("2026-09-01T08:00:00Z"),
    new Date("2026-09-14T08:00:00Z"),
  ];
  assert.deepEqual(monthlyCounts(dates, months), [1, 2]);
});
