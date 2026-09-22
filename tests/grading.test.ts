import { test } from "node:test";
import assert from "node:assert/strict";

import {
  generalAverage,
  gradingSchemeFor,
  isCompositionExam,
  officialSubjectIndex,
  schoolLevelOf,
  secondarySubjectAverage,
  SECONDARY_OFFICIAL_SUBJECTS,
  SECONDARY_OFFICIAL_TOTAL,
  weightedScore,
} from "../src/lib/grading";

test("Français : 12 et 14 aux devoirs, 13 en composition → 14 retenu, 42, puis 13,75", () => {
  const calc = secondarySubjectAverage([12, 14], 13);
  assert.equal(calc.best, 14); // le meilleur, pas la moyenne (13) ni la somme (26)
  assert.equal(calc.bestIndex, 1);
  assert.equal(calc.bestTimes3, 42);
  assert.equal(calc.average, 13.75); // (42 + 13) / 4 = 55 / 4
});

test("Anglais : un seul devoir, 10, et 11 en composition → 10,25", () => {
  const calc = secondarySubjectAverage([10], 11);
  assert.equal(calc.bestTimes3, 30);
  assert.equal(calc.average, 10.25); // (30 + 11) / 4 = 41 / 4
});

test("trois devoirs 12, 14 et 9 : seul le 14 compte, le diviseur reste 4", () => {
  const calc = secondarySubjectAverage([12, 14, 9], 10);
  assert.equal(calc.best, 14);
  assert.equal(calc.average, (14 * 3 + 10) / 4);
});

test("un devoir manqué est ignoré, jamais compté zéro", () => {
  assert.equal(secondarySubjectAverage([null, 11], 13).best, 11);
});

test("sans devoir ou sans composition, la moyenne de la matière reste vide", () => {
  assert.equal(secondarySubjectAverage([], 13).average, null);
  assert.equal(secondarySubjectAverage([null], 13).average, null);
  assert.equal(secondarySubjectAverage([12, 14], null).average, null);
  assert.equal(secondarySubjectAverage([12, 14], null).best, 14);
});

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
});

test("la formule du secondaire ne s'applique qu'au collège et au lycée", () => {
  assert.equal(gradingSchemeFor("COLLEGE"), "SECONDARY");
  assert.equal(gradingSchemeFor("LYCEE"), "SECONDARY");
  assert.equal(gradingSchemeFor("FONDAMENTAL"), "STANDARD");
  // Un niveau inconnu garde le calcul d'origine plutôt qu'une règle devinée.
  assert.equal(gradingSchemeFor(null), "STANDARD");
});

test("composition ou devoir, d'après le type ou, à défaut, le titre", () => {
  assert.equal(isCompositionExam({ kind: "COMPOSITION", title: "Examen" }), true);
  assert.equal(isCompositionExam({ kind: "DEVOIR", title: "Devoir 1" }), false);
  assert.equal(isCompositionExam({ kind: "INTERROGATION", title: "Interro" }), false);
  assert.equal(isCompositionExam({ kind: null, title: "Composition Trimestre 1" }), true);
  assert.equal(isCompositionExam({ kind: null, title: "Devoir surveillé n°1" }), false);
});
