import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classTone,
  groupByCategory,
  mainTeacherCount,
  matchesClassFilters,
  missingSetup,
} from "../src/lib/classes-list";

const khadijetou = { id: "t1", firstName: "Khadijetou", lastName: "Mint Ely" };

const ready = {
  name: "1AF",
  level: "1AF",
  mainTeacher: khadijetou,
  assignments: [{ subjectId: "s1" }],
};
const incomplete = { name: "5AS", level: "5AS", mainTeacher: null, assignments: [] };

test("une classe sans matière ni professeur principal est incomplète", () => {
  assert.deepEqual(missingSetup(ready), []);
  assert.deepEqual(missingSetup(incomplete), ["subjects", "mainTeacher"]);
});

test("le filtre garde les classes de la catégorie choisie, ou celles à compléter", () => {
  assert.equal(matchesClassFilters(ready, "", "FONDAMENTAL"), true);
  assert.equal(matchesClassFilters(ready, "", "LYCEE"), false);
  assert.equal(matchesClassFilters(incomplete, "", "LYCEE"), true); // ancienne 5AS
  const jardin = { ...ready, name: "Jardin", level: "Jardin", category: "PRESCOLAIRE" };
  assert.equal(matchesClassFilters(jardin, "", "PRESCOLAIRE"), true);
  const mahadra = { ...ready, name: "Niveau 1", level: "Niveau 1", category: "Mahadra" };
  assert.equal(matchesClassFilters(mahadra, "", "FONDAMENTAL"), false);
  assert.equal(matchesClassFilters(mahadra, "", "ALL"), true);
  assert.equal(matchesClassFilters(ready, "", "INCOMPLETE"), false);
  assert.equal(matchesClassFilters(incomplete, "", "INCOMPLETE"), true);
});

test("la recherche porte sur le nom, le niveau et le professeur, sans accents", () => {
  assert.equal(matchesClassFilters(ready, "1af", "ALL"), true);
  assert.equal(matchesClassFilters(ready, "khadíjetou", "ALL"), true);
  assert.equal(matchesClassFilters(incomplete, "khadijetou", "ALL"), false);
});

test("les couleurs alternent sur quatre teintes", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(classTone), ["green", "blue", "amber", "violet", "green"]);
});

test("un professeur principal de deux classes ne compte qu'une fois", () => {
  assert.equal(
    mainTeacherCount([{ mainTeacher: khadijetou }, { mainTeacher: khadijetou }, { mainTeacher: null }]),
    1,
  );
});

test("les classes sont regroupées par catégorie, dans l'ordre reçu", () => {
  const item = (name: string, category: string | null = null) => ({
    row: { name, level: name.split(" ")[0], category, mainTeacher: null, assignments: [] },
  });
  const groups = groupByCategory([item("Jardin"), item("1AF A"), item("1AF B"), item("2AS"), item("5SN"), item("Niveau 1", "Mahadra"), item("Spéciale")]);
  assert.deepEqual(
    groups.map((g) => [g.category, g.items.map((i) => i.row.name)]),
    [
      ["PRESCOLAIRE", ["Jardin"]],
      ["FONDAMENTAL", ["1AF A", "1AF B"]],
      ["COLLEGE", ["2AS"]],
      ["LYCEE", ["5SN"]],
      ["Mahadra", ["Niveau 1"]],
      [null, ["Spéciale"]],
    ],
  );
});
