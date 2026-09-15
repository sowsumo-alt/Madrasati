import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classCycle,
  classTone,
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

test("le cycle se lit sur le niveau mauritanien", () => {
  assert.equal(classCycle("1AF"), "AF");
  assert.equal(classCycle("5 as"), "AS");
  assert.equal(classCycle("Classe spéciale"), null);
});

test("une classe sans matière ni professeur principal est incomplète", () => {
  assert.deepEqual(missingSetup(ready), []);
  assert.deepEqual(missingSetup(incomplete), ["subjects", "mainTeacher"]);
});

test("le filtre garde les classes du cycle choisi, ou celles à compléter", () => {
  assert.equal(matchesClassFilters(ready, "", "AF"), true);
  assert.equal(matchesClassFilters(ready, "", "AS"), false);
  assert.equal(matchesClassFilters(incomplete, "", "AS"), true);
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
