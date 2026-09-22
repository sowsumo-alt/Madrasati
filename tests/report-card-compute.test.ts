import { test } from "node:test";
import assert from "node:assert/strict";

import { computeReportCards, type ReportCardExam } from "../src/lib/report-card-compute";
import { defaultGradingConfig, type GradingConfig } from "../src/lib/grading-config";

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

function cardsFor(classLevel: string, config?: GradingConfig, list = exams) {
  return computeReportCards({
    className: classLevel,
    classLevel,
    term: "Trimestre 1",
    subjects,
    students,
    exams: list,
    attendance: new Map(),
    config,
  });
}

test("règle par défaut, classe AS : meilleur devoir × 3 + composition, ÷ 4", () => {
  const mary = cardsFor("1AS").find((c) => c.student.id === "mary")!;
  assert.equal(mary.scheme, "SECONDARY");
  assert.equal(mary.schoolLevel, "COLLEGE");

  const [fr, en] = mary.results;
  assert.deepEqual(fr.detail.parts[0].scores, [12, 14]);
  assert.equal(fr.detail.parts[0].usedIndex, 1); // le 14, pas leur moyenne
  assert.equal(fr.detail.parts[0].weighted, 42); // 14 × 3
  assert.equal(fr.detail.parts[1].value, 13);
  assert.equal(fr.average, 13.75); // (42 + 13) / 4

  assert.equal(en.detail.parts[0].weighted, 30);
  assert.equal(en.average, 10.25);

  // (55 + 10,25) ÷ (4 + 1) = 65,25 ÷ 5 = 13,05
  assert.equal(mary.totalCoefficients, 5);
  assert.equal(mary.totalPoints, 65.25);
  assert.equal(mary.average, 13.05);
});

test("règle par défaut, classe AS : rang général et rang par matière", () => {
  const cards = cardsFor("1AS");
  const mary = cards.find((c) => c.student.id === "mary")!;
  const awa = cards.find((c) => c.student.id === "awa")!;
  // Awa : Français (11×3+10)/4 = 10,75 ; Anglais (15×3+14)/4 = 14,75
  assert.equal(awa.results[0].average, 10.75);
  assert.equal(awa.results[1].average, 14.75);
  assert.equal(mary.rank, 1);
  assert.equal(awa.rank, 2);
  assert.equal(mary.results[0].detail.rank, 1); // meilleure en français
  assert.equal(mary.results[1].detail.rank, 2); // deuxième en anglais
});

test("règle par défaut, classe AF : moyenne simple de toutes les notes", () => {
  const mary = cardsFor("1AF").find((c) => c.student.id === "mary")!;
  assert.equal(mary.scheme, "STANDARD");
  assert.equal(mary.schoolLevel, "FONDAMENTAL");
  // (12 + 14 + 13) / 3 = 13, et non 13,75 : la règle du secondaire ne
  // touche pas le Fondamental.
  assert.equal(mary.results[0].average, 13);
  assert.equal(mary.results[1].average, 10.5); // (10 + 11) / 2
  assert.equal(mary.average, (13 * 4 + 10.5 * 1) / 5);
});

test("classe au niveau inconnu : la règle du Fondamental, jamais celle du secondaire", () => {
  const mary = cardsFor("Classe spéciale").find((c) => c.student.id === "mary")!;
  assert.equal(mary.scheme, "STANDARD");
  assert.equal(mary.results[0].average, 13);
});

test("règle par défaut : une composition manquée laisse la matière sans moyenne", () => {
  const mary = cardsFor("2AS", undefined, [
    exam("fr", "Devoir 1", "DEVOIR", 5, { mary: 12 }),
    exam("fr", "Composition", "COMPOSITION", 28, { mary: null }),
    exam("en", "Devoir 1", "DEVOIR", 8, { mary: 10 }),
    exam("en", "Composition", "COMPOSITION", 29, { mary: 11 }),
  ]).find((c) => c.student.id === "mary")!;
  assert.equal(mary.results[0].average, null);
  // Seul l'anglais compte : 10,25 × 1 ÷ 1.
  assert.equal(mary.totalCoefficients, 1);
  assert.equal(mary.average, 10.25);
});

// —— Chaque école calcule selon SA règle ——

/** Une école qui fait la moyenne de ses devoirs, sans composition ni ×3. */
function simpleAverageConfig(): GradingConfig {
  const config = defaultGradingConfig();
  config.secondary = {
    parts: [
      {
        id: "devoir",
        label: "Devoirs",
        kinds: ["DEVOIR", "CONTROLE", "INTERROGATION"],
        weight: 1,
        multiple: "AVERAGE",
        required: true,
      },
    ],
    divisor: { mode: "AUTO" },
  };
  return config;
}

test("deux écoles, les mêmes notes, deux moyennes : chacune suit sa règle", () => {
  const ngalam = cardsFor("1AS").find((c) => c.student.id === "mary")!;
  const autre = cardsFor("1AS", simpleAverageConfig()).find((c) => c.student.id === "mary")!;

  assert.equal(ngalam.results[0].average, 13.75); // (14 × 3 + 13) ÷ 4
  assert.equal(autre.results[0].average, 13); // (12 + 14) ÷ 2, la composition n'entre pas
  assert.equal(autre.results[1].average, 10); // un seul devoir : 10
  assert.equal(autre.average, (13 * 4 + 10 * 1) / 5);
  // La règle de la seconde école n'a rien changé pour la première.
  assert.equal(ngalam.average, 13.05);
});

test("diviseur imposé : une école peut diviser par le nombre qu'elle veut", () => {
  const config = defaultGradingConfig();
  config.secondary.divisor = { mode: "FIXED", value: 5 };
  const mary = cardsFor("1AS", config).find((c) => c.student.id === "mary")!;
  assert.equal(mary.results[0].average, 11); // (42 + 13) ÷ 5
});

test("plusieurs compositions à poids différents, sans devoir", () => {
  const config = defaultGradingConfig();
  config.secondary = {
    parts: [
      {
        id: "devoir",
        label: "Devoirs",
        kinds: ["DEVOIR"],
        weight: 1,
        multiple: "AVERAGE",
        required: false,
      },
      {
        id: "compo",
        label: "Compositions",
        kinds: ["COMPOSITION"],
        weight: 2,
        multiple: "AVERAGE",
        required: true,
      },
    ],
    divisor: { mode: "AUTO" },
  };
  const mary = cardsFor("1AS", config).find((c) => c.student.id === "mary")!;
  // Français : devoirs (12 + 14)/2 = 13 × 1, composition 13 × 2 → 39 ÷ 3
  assert.equal(mary.results[0].average, 13);
});

test("un bloc facultatif sans note sort du calcul, poids compris", () => {
  const config = defaultGradingConfig();
  config.secondary.parts[0] = { ...config.secondary.parts[0], required: false };
  const mary = cardsFor("1AS", config, [
    exam("fr", "Composition", "COMPOSITION", 28, { mary: 13 }),
  ]).find((c) => c.student.id === "mary")!;
  // Sans devoir : 13 × 1 ÷ 1, et non 13 ÷ 4.
  assert.equal(mary.results[0].average, 13);
});
