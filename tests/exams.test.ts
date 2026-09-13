import { test } from "node:test";
import assert from "node:assert/strict";

import { defaultTermForDate, examStatus, parseTime } from "../src/lib/exams";

/**
 * L'état affiché dans la liste des examens décide de ce que le directeur fait
 * ensuite : préparer, surveiller ou saisir les notes.
 */

const d = (iso: string) => new Date(iso);

test("un examen avec heure est en cours de son début à sa fin", () => {
  const exam = { date: "2026-09-15T00:00:00.000Z", startMinutes: 8 * 60, durationMinutes: 90 };
  assert.equal(examStatus(exam, d("2026-09-15T07:59:00Z")), "PLANNED");
  assert.equal(examStatus(exam, d("2026-09-15T08:00:00Z")), "ONGOING");
  assert.equal(examStatus(exam, d("2026-09-15T09:29:00Z")), "ONGOING");
  assert.equal(examStatus(exam, d("2026-09-15T09:30:00Z")), "DONE");
});

test("sans durée, un examen dure une heure", () => {
  const exam = { date: "2026-09-15T00:00:00.000Z", startMinutes: 10 * 60, durationMinutes: null };
  assert.equal(examStatus(exam, d("2026-09-15T10:59:00Z")), "ONGOING");
  assert.equal(examStatus(exam, d("2026-09-15T11:00:00Z")), "DONE");
});

test("un examen planifié sans heure est en cours toute la journée", () => {
  const exam = { date: "2026-09-15T00:00:00.000Z", startMinutes: null, durationMinutes: 60 };
  assert.equal(examStatus(exam, d("2026-09-14T23:59:00Z")), "PLANNED");
  assert.equal(examStatus(exam, d("2026-09-15T17:00:00Z")), "ONGOING");
  assert.equal(examStatus(exam, d("2026-09-16T00:00:00Z")), "DONE");
});

test("le trimestre proposé suit le calendrier scolaire mauritanien", () => {
  assert.equal(defaultTermForDate("2026-09-20"), "Trimestre 1");
  assert.equal(defaultTermForDate("2026-12-15"), "Trimestre 1");
  assert.equal(defaultTermForDate("2027-01-10"), "Trimestre 2");
  assert.equal(defaultTermForDate("2027-03-31"), "Trimestre 2");
  assert.equal(defaultTermForDate("2027-04-01"), "Trimestre 3");
  assert.equal(defaultTermForDate("2027-06-20"), "Trimestre 3");
});

test("l'heure saisie est lue en minutes, ou refusée", () => {
  assert.equal(parseTime("08:30"), 510);
  assert.equal(parseTime("8:05"), 485);
  assert.equal(parseTime("24:00"), null);
  assert.equal(parseTime("--:--"), null);
});
