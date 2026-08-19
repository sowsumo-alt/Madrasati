import { test } from "node:test";
import assert from "node:assert/strict";

import { initialsOf, matchesLetter } from "../src/components/ui/alphabet-filter";

/**
 * La recherche par initiale indexe *chacun* des noms d'une personne, et non le
 * seul nom de famille. C'est un choix dicté par les noms mauritaniens : avec
 * les particules « Ould » et « Mint », un classement sur le nom de famille
 * entasserait la moitié d'une école sous O et M, et un directeur qui cherche
 * « Fatimetou Mint Salem » sous S ne la trouverait jamais. Ces tests fixent ce
 * comportement, qui n'est pas devinable à la lecture du code d'affichage.
 */

test("un nom mauritanien répond à chacune de ses initiales", () => {
  assert.deepEqual(initialsOf("Fatimetou Mint Salem"), ["F", "M", "S"]);
  assert.deepEqual(initialsOf("Mohamed Ould Ahmed"), ["M", "O", "A"]);
});

test("on retrouve un élève sous le nom auquel on pense, pas seulement le premier", () => {
  assert.ok(matchesLetter("Fatimetou Mint Salem", "S"), "cherché sous Salem");
  assert.ok(matchesLetter("Fatimetou Mint Salem", "F"), "cherché sous Fatimetou");
  assert.ok(matchesLetter("Fatimetou Mint Salem", "M"), "cherché sous Mint");
  assert.ok(!matchesLetter("Fatimetou Mint Salem", "B"));
});

test("les accents ne changent pas la lettre", () => {
  assert.deepEqual(initialsOf("Aïcha Ba"), ["A", "B"]);
  assert.deepEqual(initialsOf("Abdoulaye Cissé"), ["A", "C"]);
  assert.ok(matchesLetter("Élodie Ndiaye", "E"));
});

test("les noms composés et les apostrophes sont découpés", () => {
  assert.deepEqual(initialsOf("Marie-Claire Diop"), ["M", "C", "D"]);
  assert.deepEqual(initialsOf("Oum'Kelthoum Sy"), ["O", "K", "S"]);
});

test("une même initiale n'est pas comptée deux fois", () => {
  assert.deepEqual(initialsOf("Sidi Sow Sy"), ["S"]);
});

test("aucune lettre choisie : tout le monde passe", () => {
  assert.ok(matchesLetter("Mohamed Ould Ahmed", null));
  assert.ok(matchesLetter("", null));
});

test("les espaces multiples et les noms vides ne produisent pas de lettre fantôme", () => {
  assert.deepEqual(initialsOf("  Kane   Fatou  "), ["K", "F"]);
  assert.deepEqual(initialsOf(""), []);
  assert.deepEqual(initialsOf("   "), []);
});

test("un nom qui ne commence pas par une lettre latine est ignoré, sans planter", () => {
  // Un nom saisi en arabe ou commençant par un chiffre n'a pas de case dans
  // un alphabet A–Z : il ne doit pas créer de bouton, ni faire échouer le
  // filtre pour tous les autres.
  assert.deepEqual(initialsOf("محمد"), []);
  assert.deepEqual(initialsOf("2Pac Diallo"), ["D"]);
});
