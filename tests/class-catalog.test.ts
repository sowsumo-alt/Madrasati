import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCatalog,
  classCategory,
  compareClasses,
  composeClassName,
  findStandardLevel,
  nextClassName,
  sectionOf,
  STANDARD_LEVELS,
} from "../src/lib/class-catalog";
import { gradingSchemeFor, schoolLevelOf } from "../src/lib/grading";
import { standardClassesFor } from "../src/lib/school-levels";

test("les quatre catégories proposent les niveaux du système mauritanien", () => {
  assert.deepEqual(STANDARD_LEVELS.PRESCOLAIRE, ["Petite Section", "Moyenne Section", "Grande Section", "Jardin"]);
  assert.deepEqual(STANDARD_LEVELS.FONDAMENTAL, ["1AF", "2AF", "3AF", "4AF", "5AF", "6AF"]);
  assert.deepEqual(STANDARD_LEVELS.COLLEGE, ["1AS", "2AS", "3AS"]);
  assert.deepEqual(STANDARD_LEVELS.LYCEE, ["4D", "5SN", "5A", "6SN", "6A", "7SN", "7A"]);
});

test("chaque niveau du collège et du lycée reçoit le bulletin du secondaire", () => {
  for (const level of [...STANDARD_LEVELS.COLLEGE, ...STANDARD_LEVELS.LYCEE]) {
    assert.equal(gradingSchemeFor(schoolLevelOf(level)), "SECONDARY", level);
  }
  for (const level of [...STANDARD_LEVELS.PRESCOLAIRE, ...STANDARD_LEVELS.FONDAMENTAL]) {
    assert.equal(gradingSchemeFor(schoolLevelOf(level)), "STANDARD", level);
  }
});

test("le nom d'une classe suit son niveau et sa section", () => {
  assert.equal(composeClassName("1AF", "A"), "1AF A");
  assert.equal(composeClassName("5SN", ""), "5SN");
  assert.equal(sectionOf("1AF B", "1AF"), "B");
  assert.equal(sectionOf("5SN", "5SN"), "");
});

test("sans section saisie, une classe d'un niveau existant prend la lettre suivante", () => {
  assert.equal(nextClassName("1AF", "", []), "1AF");
  assert.equal(nextClassName("1AF", "", ["1AF", "2AF"]), "1AF B");
  assert.equal(nextClassName("1AF", "", ["1AF", "1AF B"]), "1AF C");
  assert.equal(nextClassName("1AF", "", ["1AF A"]), "1AF B");
  assert.equal(nextClassName("1AF", "", ["1AFX", "11AF"]), "1AF"); // autres niveaux
  assert.equal(nextClassName("5SN", "", ["5SN", "5A"]), "5SN B");
  // Une section saisie est gardée telle quelle.
  assert.equal(nextClassName("1AF", "C", ["1AF"]), "1AF C");
});

test("la catégorie se lit sur la classe, même créée avant les catégories", () => {
  assert.equal(classCategory({ category: "Mahadra", level: "Niveau 1" }), "Mahadra");
  assert.equal(classCategory({ level: "3AF", name: "3AF B" }), "FONDAMENTAL");
  assert.equal(classCategory({ level: "4AS" }), "COLLEGE");
  assert.equal(classCategory({ level: "5AS" }), "LYCEE");
  assert.equal(classCategory({ level: "jardin" }), "PRESCOLAIRE");
  assert.equal(classCategory({ level: "Classe spéciale" }), null);
  assert.deepEqual(findStandardLevel("JARDIN"), { category: "PRESCOLAIRE", level: "Jardin" });
  assert.deepEqual(findStandardLevel("5 sn"), { category: "LYCEE", level: "5SN" });
});

test("les niveaux et catégories ajoutés par l'école lui sont reproposés", () => {
  const catalog = buildCatalog([
    { category: "PRESCOLAIRE", level: "Jardin 2" },
    { category: "Mahadra", level: "Niveau 1" },
    { category: null, level: "1AF" },
  ]);
  assert.deepEqual(catalog.map((g) => g.label), ["Préscolaire", "Fondamental", "Collège", "Lycée", "Mahadra"]);
  assert.ok(catalog[0].levels.includes("Jardin 2"));
  assert.equal(catalog[1].levels.filter((l) => l === "1AF").length, 1);
  assert.deepEqual(catalog[4].levels, ["Niveau 1"]);
});

test("les classes se rangent dans l'ordre de la scolarité", () => {
  const names = ["5SN", "1AF B", "Jardin", "4D", "1AF A", "2AS", "Niveau 1"].map((name) => ({
    name,
    level: name.split(" ")[0] === "Niveau" ? name : name.split(" ")[0],
    category: name === "Niveau 1" ? "Mahadra" : null,
  }));
  assert.deepEqual(
    names.sort(compareClasses).map((c) => c.name),
    ["Jardin", "1AF A", "1AF B", "2AS", "4D", "5SN", "Niveau 1"],
  );
});

test("une nouvelle école reçoit les niveaux du catalogue", () => {
  const levels = standardClassesFor("complet").map((c) => c.level);
  assert.deepEqual(levels, [...STANDARD_LEVELS.FONDAMENTAL, ...STANDARD_LEVELS.COLLEGE, ...STANDARD_LEVELS.LYCEE]);
  assert.equal(standardClassesFor("complet").find((c) => c.level === "5SN")?.category, "LYCEE");
});
