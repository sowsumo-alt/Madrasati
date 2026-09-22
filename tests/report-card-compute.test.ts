import { test } from "node:test";
import assert from "node:assert/strict";

import { computeReportCards, type ReportCardExam } from "../src/lib/report-card-compute";

const students = [
  { id: "mary", firstName: "Mary", lastName: "Ba" },
  { id: "awa", firstName: "Awa", lastName: "Sow" },
];
const subjects = [
  { id: "fr", name: "Français", nameAr: "الفرنسية", coefficient: 4 },
  { id: "en", name: "Anglais", nameAr: "الإنجليزية", coefficient: 1 },
];

function exam(
  subjectId: string,
  title: string,
  kind: string | null,
  day: number,
  scores: Record<string, number | null>,
): ReportCardExam {
  return {
    subjectId,
    title,
    kind,
    date: new Date(Date.UTC(2026, 9, day)),
    maxScore: 20,
    grades: Object.entries(scores).map(([studentId, score]) => ({
      studentId,
      score,
      isAbsent: score == null,
      comment: null,
    })),
  };
}

// Les notes de l'exemple confirmé par le directeur d'École Ngalam.
const exams = [
  exam("fr", "Devoir 1", "DEVOIR", 5, { mary: 12, awa: 9 }),
  exam("fr", "Devoir 2", "DEVOIR", 20, { mary: 14, awa: 11 }),
  exam("fr", "Composition", "COMPOSITION", 28, { mary: 13, awa: 10 }),
  exam("en", "Devoir 1", "DEVOIR", 8, { mary: 10, awa: 15 }),
  exam("en", "Composition", "COMPOSITION", 29, { mary: 11, awa: 14 }),
];

function cardsFor(classLevel: string) {
  return computeReportCards({
    className: classLevel,
    classLevel,
    term: "Trimestre 1",
    subjects,
    students,
    exams,
    attendance: new Map(),
  });
}

test("classe AS : bulletin officiel, meilleur devoir × 3 + composition, ÷ 4", () => {
  const mary = cardsFor("1AS").find((c) => c.student.id === "mary")!;
  assert.equal(mary.scheme, "SECONDARY");
  assert.equal(mary.schoolLevel, "COLLEGE");

  const [fr, en] = mary.results;
  assert.equal(fr.secondary!.best, 14);
  assert.equal(fr.secondary!.bestIndex, 1);
  assert.equal(fr.secondary!.bestTimes3, 42);
  assert.equal(fr.secondary!.composition, 13);
  assert.equal(fr.average, 13.75);
  assert.equal(fr.secondary!.weighted, 55);

  assert.equal(en.secondary!.bestTimes3, 30);
  assert.equal(en.average, 10.25);
  assert.equal(en.secondary!.weighted, 10.25);

  // (55 + 10,25) ÷ (4 + 1) = 65,25 ÷ 5 = 13,05
  assert.equal(mary.totalCoefficients, 5);
  assert.equal(mary.totalPoints, 65.25);
  assert.equal(mary.average, 13.05);
});

test("classe AS : rang général et rang par matière", () => {
  const cards = cardsFor("1AS");
  const mary = cards.find((c) => c.student.id === "mary")!;
  const awa = cards.find((c) => c.student.id === "awa")!;
  // Awa : Français (11×3+10)/4 = 10,75 ; Anglais (15×3+14)/4 = 14,75
  assert.equal(awa.results[0].average, 10.75);
  assert.equal(awa.results[1].average, 14.75);
  assert.equal(awa.average, Math.round(((10.75 * 4 + 14.75) / 5) * 100) / 100);
  assert.equal(mary.rank, 1);
  assert.equal(awa.rank, 2);
  assert.equal(mary.results[0].secondary!.rank, 1); // meilleure en français
  assert.equal(mary.results[1].secondary!.rank, 2); // deuxième en anglais
});

test("classe AF : le Fondamental garde exactement le calcul d'origine", () => {
  const mary = cardsFor("1AF").find((c) => c.student.id === "mary")!;
  assert.equal(mary.scheme, "STANDARD");
  assert.equal(mary.schoolLevel, "FONDAMENTAL");
  assert.equal(mary.results[0].secondary, undefined);
  // Moyenne simple de toutes les notes : (12 + 14 + 13) / 3 = 13, et non 13,75.
  assert.equal(mary.results[0].average, 13);
  assert.equal(mary.results[1].average, 10.5); // (10 + 11) / 2
  assert.equal(mary.average, (13 * 4 + 10.5 * 1) / 5);
});

test("classe au niveau inconnu : calcul d'origine, jamais la règle du secondaire", () => {
  const mary = cardsFor("Classe spéciale").find((c) => c.student.id === "mary")!;
  assert.equal(mary.scheme, "STANDARD");
  assert.equal(mary.results[0].average, 13);
});

test("classe AS : une composition manquée laisse la matière sans moyenne", () => {
  const cards = computeReportCards({
    className: "2AS",
    classLevel: "2AS",
    term: "Trimestre 1",
    subjects,
    students,
    exams: [
      exam("fr", "Devoir 1", "DEVOIR", 5, { mary: 12 }),
      exam("fr", "Composition", "COMPOSITION", 28, { mary: null }),
      exam("en", "Devoir 1", "DEVOIR", 8, { mary: 10 }),
      exam("en", "Composition", "COMPOSITION", 29, { mary: 11 }),
    ],
    attendance: new Map(),
  });
  const mary = cards.find((c) => c.student.id === "mary")!;
  assert.equal(mary.results[0].average, null);
  assert.equal(mary.results[0].secondary!.compositionAbsent, true);
  // Seul l'anglais compte : 10,25 × 1 ÷ 1.
  assert.equal(mary.totalCoefficients, 1);
  assert.equal(mary.average, 10.25);
});
