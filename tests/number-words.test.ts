import { test } from "node:test";
import assert from "node:assert/strict";

import { amountInWords, numberToFrenchWords } from "../src/lib/number-words";

test("les montants des reçus s'écrivent en lettres", () => {
  const cases: [number, string][] = [
    [0, "zéro"],
    [1, "un"],
    [16, "seize"],
    [21, "vingt et un"],
    [71, "soixante et onze"],
    [72, "soixante-douze"],
    [80, "quatre-vingts"],
    [81, "quatre-vingt-un"],
    [99, "quatre-vingt-dix-neuf"],
    [100, "cent"],
    [200, "deux cents"],
    [201, "deux cent un"],
    [1000, "mille"],
    [1600, "mille six cents"],
    [5000, "cinq mille"],
    [15000, "quinze mille"],
    [20000, "vingt mille"],
    [80000, "quatre-vingt mille"],
    [200000, "deux cent mille"],
    [1_000_000, "un million"],
    [2_500_000, "deux millions cinq cent mille"],
    [123456, "cent vingt-trois mille quatre cent cinquante-six"],
  ];
  for (const [n, words] of cases) assert.equal(numberToFrenchWords(n), words, String(n));
});

test("la monnaie s'accorde", () => {
  assert.equal(amountInWords(20000), "vingt mille ouguiyas");
  assert.equal(amountInWords(1), "un ouguiya");
});

test("école en MRO : le montant en lettres reprend la fiche papier (MRO) et précise l'équivalent en MRU", () => {
  // 9 500 MRU = 95 000 MRO : la fiche 028 de l'école est écrite en MRO.
  assert.equal(
    amountInWords(9500, "MRO"),
    "quatre-vingt-quinze mille anciennes ouguiyas (MRO), soit neuf mille cinq cents ouguiyas (MRU)",
  );
  // Une école en MRU garde exactement le texte d'aujourd'hui.
  assert.equal(amountInWords(9500, "MRU"), "neuf mille cinq cents ouguiyas");
  assert.equal(amountInWords(9500), "neuf mille cinq cents ouguiyas");
});
