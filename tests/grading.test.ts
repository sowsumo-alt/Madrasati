import { test } from "node:test";
import assert from "node:assert/strict";

import {
  generalAverage,
  gradingSchemeFor,
  officialSubjectIndex,
  schoolLevelOf,
  SECONDARY_OFFICIAL_SUBJECTS,
  SECONDARY_OFFICIAL_TOTAL,
  weightedScore,
} from "../src/lib/grading";

test("note coefficientée : moyenne de la matière × coefficient de la matière", () => {
  assert.equal(weightedScore(13.75, 4), 55);
  assert.equal(weightedScore(10.25, 1), 10.25);
});

test("moyenne générale = somme des notes coefficientées ÷ somme des coefficients", () => {
  // Les neuf matières de la maquette validée (1°AS1, total des coefficients 24).
  const lines = [
    { average: 14, coefficient: 5 }, // Arabe
    { average: 13.75, coefficient: 4 }, // Français
    { average: 10.25, coefficient: 1 }, // Anglais
    { average: 11.5, coefficient: 5 }, // Mathématiques
    { average: 12.5, coefficient: 2 }, // Sciences Naturelles
    { average: 13, coefficient: 2 }, // Histoire-Géographie
    { average: 14, coefficient: 3 }, // Instruction Religieuse
    { average: 14.75, coefficient: 1 }, // Instruction Civique
    { average: 10, coefficient: 1 }, // Éducation Physique
  ];
  const general = generalAverage(lines);
  assert.equal(general.totalCoefficients, 24);
  assert.equal(general.totalPoints, 310.5);
  assert.equal(general.average, 310.5 / 24); // 12,9375 → imprimé 12,94
  assert.equal(general.average!.toFixed(2), "12.94");
});

test("une matière sans moyenne n'entre ni dans les points ni dans les coefficients", () => {
  const general = generalAverage([
    { average: 13.75, coefficient: 4 },
    { average: null, coefficient: 5 },
  ]);
  assert.equal(general.totalCoefficients, 4);
  assert.equal(general.average, 13.75);
});

test("coefficients officiels du secondaire : total 24", () => {
  assert.equal(SECONDARY_OFFICIAL_TOTAL, 24);
  assert.deepEqual(
    SECONDARY_OFFICIAL_SUBJECTS.map((s) => s.coefficient),
    [5, 4, 1, 5, 2, 2, 3, 1, 1],
  );
});

test("les matières existantes sont reconnues sous leurs autres noms", () => {
  assert.equal(officialSubjectIndex("Arabe"), 0);
  assert.equal(officialSubjectIndex("Études Islamiques"), 6);
  assert.equal(officialSubjectIndex("Sciences de la Vie et de la Terre"), 4);
  assert.equal(officialSubjectIndex("Histoire et Géographie"), 5);
  assert.equal(officialSubjectIndex("histoire-geographie"), 5);
  assert.equal(officialSubjectIndex("Physique-Chimie"), null);
});

test("niveau de la classe : Fondamental, Collège, Lycée", () => {
  assert.equal(schoolLevelOf("1AF"), "FONDAMENTAL");
  assert.equal(schoolLevelOf("6AF"), "FONDAMENTAL");
  assert.equal(schoolLevelOf("1AS"), "COLLEGE");
  assert.equal(schoolLevelOf("4AS"), "COLLEGE");
  assert.equal(schoolLevelOf("5AS"), "LYCEE");
  assert.equal(schoolLevelOf("7AS"), "LYCEE");
  assert.equal(schoolLevelOf("1°AS1"), "COLLEGE");
  assert.equal(schoolLevelOf("Secondaire", "1AS A"), "COLLEGE");
  assert.equal(schoolLevelOf("2 A Sud"), null);
  assert.equal(schoolLevelOf("Terminale"), null);
  // Les séries du lycée : 5C, 6°D, 7°C, 7 LM, 7 LO.
  assert.equal(schoolLevelOf("7°C"), "LYCEE");
  assert.equal(schoolLevelOf("7°D"), "LYCEE");
  assert.equal(schoolLevelOf("5C"), "LYCEE");
  assert.equal(schoolLevelOf("6 D"), "LYCEE");
  assert.equal(schoolLevelOf("7 LM"), "LYCEE");
  assert.equal(schoolLevelOf("7LO"), "LYCEE");
  assert.equal(schoolLevelOf("3C"), null); // pas une série de lycée
});

test("la formule du secondaire ne s'applique qu'au collège et au lycée", () => {
  assert.equal(gradingSchemeFor("COLLEGE"), "SECONDARY");
  assert.equal(gradingSchemeFor("LYCEE"), "SECONDARY");
  assert.equal(gradingSchemeFor("FONDAMENTAL"), "STANDARD");
  // Un niveau inconnu garde le calcul d'origine plutôt qu'une règle devinée.
  assert.equal(gradingSchemeFor(null), "STANDARD");
});