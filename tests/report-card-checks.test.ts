import { test } from "node:test";
import assert from "node:assert/strict";

import { computeReportCards, type ReportCardExam } from "../src/lib/report-card-compute";
import {
  compareCards,
  evolution,
  formatDelta,
  missingGrades,
  previousTermOf,
} from "../src/lib/report-card-checks";

const subjects = [
  { id: "ma", name: "Mathématiques", nameAr: null, coefficient: 5 },
  { id: "sn", name: "Sciences Naturelles", nameAr: null, coefficient: 2 },
  { id: "old", name: "Latin", nameAr: null, coefficient: 1, active: false },
];
const students = [{ id: "a", firstName: "Awa", lastName: "Ba" }];

function exam(subjectId: string, kind: string, score: number | null, isAbsent = false, term = "Trimestre 1"): ReportCardExam {
  return {
    subjectId,
    term,
    title: kind,
    kind,
    date: new Date(Date.UTC(2026, 9, 10)),
    maxScore: 20,
    grades: [{ studentId: "a", score, isAbsent, comment: null }],
  };
}

function card(exams: ReportCardExam[], term = "Trimestre 1") {
  return computeReportCards({
    className: "1AS",
    classLevel: "1AS",
    term,
    subjects,
    students,
    exams,
    attendance: new Map(),
  })[0];
}

test("chaque note attendue et absente est signalée, matière par matière", () => {
  const missing = missingGrades(
    card([exam("ma", "DEVOIR", 12), exam("sn", "COMPOSITION", 11)]),
  );
  assert.deepEqual(missing, [
    { subject: "Mathématiques", part: "Composition", absent: false },
    { subject: "Sciences Naturelles", part: "Devoirs", absent: false },
  ]);
});

test("une matière désactivée n'attend plus de note", () => {
  const missing = missingGrades(card([]));
  assert.equal(missing.some((m) => m.subject === "Latin"), false);
  assert.equal(missing.length, 4); // 2 matières actives × 2 types de note
});

test("un élève absent à l'épreuve est signalé comme tel, pas comme un oubli", () => {
  const missing = missingGrades(
    card([
      exam("ma", "DEVOIR", 12),
      exam("ma", "COMPOSITION", null, true),
      exam("sn", "DEVOIR", 12),
      exam("sn", "COMPOSITION", 10),
    ]),
  );
  assert.deepEqual(missing, [{ subject: "Mathématiques", part: "Composition", absent: true }]);
});

test("un bulletin complet ne signale rien", () => {
  const complete = card([
    exam("ma", "DEVOIR", 12),
    exam("ma", "COMPOSITION", 13),
    exam("sn", "DEVOIR", 12),
    exam("sn", "COMPOSITION", 10),
  ]);
  assert.deepEqual(missingGrades(complete), []);
});

test("évolution : flèche et écart par rapport au trimestre précédent", () => {
  assert.deepEqual(evolution(12.94, 12.14, "Trimestre 1"), { delta: 0.8, trend: "UP", previousTerm: "Trimestre 1" });
  assert.equal(evolution(11.2, 12.7, "Trimestre 2")!.trend, "DOWN");
  assert.equal(evolution(12, 12, "Trimestre 1")!.trend, "STABLE");
  assert.equal(evolution(12, null, "Trimestre 1"), null);
  assert.equal(formatDelta(0.8), "+0,8");
  assert.equal(formatDelta(-1.5), "-1,5");
  assert.equal(formatDelta(0), "0");
});

test("pas de comparaison au premier trimestre ni au bulletin annuel", () => {
  const terms = ["Trimestre 1", "Trimestre 2", "Trimestre 3"];
  assert.equal(previousTermOf("Trimestre 1", terms), null);
  assert.equal(previousTermOf("Trimestre 2", terms), "Trimestre 1");
  assert.equal(previousTermOf("Trimestre 3", terms), "Trimestre 2");
  assert.equal(previousTermOf("Année", terms), null);
});

test("comparaison d'un bulletin avec le précédent : général et par matière", () => {
  const t1 = card(
    [exam("ma", "DEVOIR", 10), exam("ma", "COMPOSITION", 10), exam("sn", "DEVOIR", 12), exam("sn", "COMPOSITION", 12)],
    "Trimestre 1",
  );
  const t2 = card(
    [
      exam("ma", "DEVOIR", 12, false, "Trimestre 2"),
      exam("ma", "COMPOSITION", 12, false, "Trimestre 2"),
      exam("sn", "DEVOIR", 12, false, "Trimestre 2"),
      exam("sn", "COMPOSITION", 12, false, "Trimestre 2"),
    ],
    "Trimestre 2",
  );
  const result = compareCards(t2, t1)!;
  // Général : (10×5 + 12×2) ÷ 7 = 10,57 → 12 ; écart +1,43
  assert.equal(result.general!.trend, "UP");
  assert.equal(result.general!.delta, 1.43);
  assert.equal(result.general!.previousTerm, "Trimestre 1");
  assert.equal(result.bySubject["Mathématiques"].delta, 2);
  assert.equal(result.bySubject["Sciences Naturelles"].trend, "STABLE");
  assert.equal(compareCards(t2, null), null);
});
