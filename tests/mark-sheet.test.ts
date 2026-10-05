import { test } from "node:test";
import assert from "node:assert/strict";

import { defaultGradingConfig, type Formula } from "../src/lib/grading-config";
import { markSheetColumns, orderStudents, paginateRows, sheetCountOf } from "../src/lib/mark-sheet";

const secondary = defaultGradingConfig().secondary;

test("colonnes par défaut : trois devoirs et une composition", () => {
  assert.deepEqual(
    markSheetColumns(secondary, [], false).map((c) => c.title),
    ["Devoir 1", "Devoir 2", "Devoir 3", "Composition"],
  );
  assert.equal(sheetCountOf(secondary.parts[1]), 1);
});

test("une école à deux devoirs voit deux colonnes de devoir", () => {
  const twoDevoirs: Formula = {
    ...secondary,
    parts: secondary.parts.map((p) => (p.id === "devoir" ? { ...p, sheetCount: 2 } : p)),
  };
  assert.deepEqual(
    markSheetColumns(twoDevoirs, [], false).map((c) => c.title),
    ["Devoir 1", "Devoir 2", "Composition"],
  );
});

test("pré-rempli : les examens déjà créés prennent les premières cases", () => {
  const exams = [[{ id: "e1", title: "Devoir surveillé n°1" }], [{ id: "c1", title: "Composition T1" }]];
  const cols = markSheetColumns(secondary, exams, true);
  assert.deepEqual(
    cols.map((c) => [c.title, c.examId]),
    [
      ["Devoir surveillé n°1", "e1"],
      ["Devoir 2", null],
      ["Devoir 3", null],
      ["Composition T1", "c1"],
    ],
  );
  // Sans pré-remplissage, les examens existants ne changent rien.
  assert.ok(markSheetColumns(secondary, exams, false).every((c) => c.examId === null));
});

test("le N° est celui du bulletin (nom de famille), quel que soit l'ordre choisi", () => {
  const students = [
    { id: "1", firstName: "Zeinabou", lastName: "Ba" },
    { id: "2", firstName: "Ahmed", lastName: "Sow" },
    { id: "3", firstName: "Mariem", lastName: "Diallo" },
  ];
  const byNumber = orderStudents(students, "NUMBER");
  assert.deepEqual(byNumber.map((s) => [s.number, s.firstName]), [[1, "Zeinabou"], [2, "Mariem"], [3, "Ahmed"]]);
  const byFirst = orderStudents(students, "FIRST_NAME");
  assert.deepEqual(byFirst.map((s) => [s.number, s.firstName]), [[3, "Ahmed"], [2, "Mariem"], [1, "Zeinabou"]]);
});

test("pages : en-tête répété, la signature tient sur la dernière", () => {
  assert.deepEqual(paginateRows(18, 24, 20), [[0, 18]]);
  assert.deepEqual(paginateRows(30, 24, 20), [[0, 24], [24, 30]]);
  // 22 élèves : une page pleine ne laisserait pas la place de signer.
  assert.deepEqual(paginateRows(22, 24, 20), [[0, 21], [21, 22]]);
  const fifty = paginateRows(50, 24, 20);
  assert.equal(fifty.at(-1)![1], 50);
  assert.ok(fifty.every(([a, b]) => b - a <= 24));
  assert.ok(fifty.at(-1)![1] - fifty.at(-1)![0] <= 20);
});
