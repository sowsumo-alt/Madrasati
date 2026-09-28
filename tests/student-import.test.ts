import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildImportPreview,
  findHeaderRow,
  findTitle,
  parseBirthDate,
  parseGender,
  splitBirthPlaceDate,
  splitImportedName,
  suggestClassFromTitle,
  suggestField,
  type ImportCell,
} from "../src/lib/student-import";

// Fichier tel qu'une école le tient : titre, en-têtes, élèves, totaux.
const SHEET: ImportCell[][] = [
  ["GROUPE SCOLAIRE NGALAM AVENIR"],
  [],
  ["JARDIN"],
  ["N°", "Prénoms et Nom", "Lieu et date de naissance", "Sexe", "NNI", "RIM", "Tél"],
  [1, "Mohamed Lemine Ould Sidi", "Nouakchott le 12/03/2021", "M", "1234567890", "150231", "46 00 02 74"],
  [2, "Fatimetou Mint Ahmed", "Kiffa 05/11/2020", "F", "2345678901", "150232", "36000274"],
  [3, "Aminata Moussa Diallo", "Rosso", "Fille", "123", "150233", ""],
  [4, "", "", "", "", "", ""],
  [5, "", "Atar", "", "", "", ""],
  [],
  ["", "Effectif", "", "", "", "", 40],
  ["", "Nombre de Garçons", "", "", "", "", 22],
  ["", "Nombre de Filles", "", "", "", "", 18],
];

test("l'en-tête du tableau et le titre au-dessus sont retrouvés", () => {
  const header = findHeaderRow(SHEET);
  assert.equal(header, 3);
  assert.equal(findTitle(SHEET, header), "JARDIN");
  assert.deepEqual(suggestClassFromTitle("JARDIN"), { category: "PRESCOLAIRE", level: "Jardin", section: "" });
  // Valable pour toutes les classes, même quand le titre dit autre chose autour.
  assert.deepEqual(suggestClassFromTitle("Liste des élèves 1AF B"), { category: "FONDAMENTAL", level: "1AF", section: "B" });
  assert.deepEqual(suggestClassFromTitle("CLASSE : 5 SN"), { category: "LYCEE", level: "5SN", section: "" });
  assert.deepEqual(suggestClassFromTitle("Petite Section"), { category: "PRESCOLAIRE", level: "Petite Section", section: "" });
});

test("les colonnes habituelles des écoles sont reconnues, même sans en-tête", () => {
  const header = SHEET[3];
  const samples = (i: number) => SHEET.slice(4, 7).map((r) => r[i]);
  assert.deepEqual(
    header.map((h, i) => suggestField(h, samples(i))),
    ["number", "fullName", "birthPlaceDate", "gender", "nni", "rimNumber", "phone"],
  );
  assert.equal(suggestField("Nationalité"), "nationality");
  assert.equal(suggestField("", ["RIM", "RIM"]), "nationality");
  assert.equal(suggestField("PRENOM ET NOM"), "fullName");
  assert.equal(suggestField("Date de naissance"), "dateOfBirth");
  assert.equal(suggestField("Téléphone"), "phone");
  assert.equal(suggestField("Nom"), "lastName");
  assert.equal(suggestField("Prénom"), "firstName");
  assert.equal(suggestField("Observations", ["bon élève"]), "ignore");
});

test("prénoms et nom combinés sont séparés, particules mauritaniennes comprises", () => {
  assert.deepEqual(splitImportedName("Mohamed Lemine Ould Sidi"), { firstName: "Mohamed Lemine", lastName: "Ould Sidi" });
  assert.deepEqual(splitImportedName("Fatimetou Mint Ahmed"), { firstName: "Fatimetou", lastName: "Mint Ahmed" });
  assert.deepEqual(splitImportedName("Aminata Moussa Diallo"), { firstName: "Aminata Moussa", lastName: "Diallo" });
  assert.deepEqual(splitImportedName("Souley  Diop"), { firstName: "Souley", lastName: "Diop" });
});

test("genre, date et lieu de naissance sont lus sous leurs formes habituelles", () => {
  assert.equal(parseGender("G"), "M");
  assert.equal(parseGender("Garçon"), "M");
  assert.equal(parseGender("fille"), "F");
  assert.equal(parseGender("?"), null);
  assert.equal(parseBirthDate("12/03/2021"), "2021-03-12");
  assert.equal(parseBirthDate(new Date(2020, 10, 5)), "2020-11-05");
  assert.equal(parseBirthDate("44267"), "2021-03-12");
  assert.equal(parseBirthDate("2021"), null);
  assert.deepEqual(splitBirthPlaceDate("Nouakchott le 12/03/2021"), { place: "Nouakchott", date: "2021-03-12" });
  assert.deepEqual(splitBirthPlaceDate("Rosso"), { place: "Rosso", date: null });
});

test("seuls les vrais élèves sont importés ; les totaux et lignes vides sont ignorés", () => {
  const mapping = ["number", "fullName", "birthPlaceDate", "gender", "nni", "rimNumber", "phone"] as const;
  const preview = buildImportPreview(SHEET, 3, [...mapping]);

  assert.equal(preview.students.length, 3);
  assert.deepEqual(
    preview.ignored.map((i) => i.reason),
    ["Ligne sans élève", "Ligne de total", "Ligne de total", "Ligne de total"],
  );
  // La ligne n° 5 a un lieu de naissance mais pas de nom : à vérifier.
  assert.deepEqual(preview.errors.map((e) => [e.row, e.reason]), [[9, "Nom manquant"]]);

  const [mohamed, fatimetou, aminata] = preview.students;
  assert.equal(mohamed.firstName, "Mohamed Lemine");
  assert.equal(mohamed.lastName, "Ould Sidi");
  assert.equal(mohamed.dateOfBirth, "2021-03-12");
  assert.equal(mohamed.placeOfBirth, "Nouakchott");
  assert.equal(mohamed.nni, "1234567890");
  assert.equal(mohamed.rimNumber, "150231");
  assert.equal(mohamed.phone, "46000274");
  assert.equal(fatimetou.gender, "F");
  assert.equal(aminata.gender, "F"); // « Fille » n'est pas une ligne de total
  assert.equal(aminata.nni, null);
  assert.deepEqual(aminata.warnings, ["NNI incomplet, laissé vide"]);
});

test("les totaux écrits autrement (pluriel, « Effective ») ne deviennent jamais des élèves", () => {
  const rows: ImportCell[][] = [
    ["N°", "Prénoms et Nom", "NNI"],
    [1, "Mounira Mint Abidine", ""],
    ["", "Nombres de Filles: 10", ""],
    ["", "Nombres de Garçons: : 10", ""],
    ["", "Effective 20", ""],
    ["", "Total 40", ""],
    ["", "Classe 12 élèves", ""],
  ];
  const preview = buildImportPreview(rows, 0, ["number", "fullName", "nni"]);
  assert.deepEqual(preview.students.map((s) => s.firstName), ["Mounira"]);
  assert.equal(preview.ignored.filter((i) => i.reason === "Ligne de total").length, 4);
  // Un nom avec des chiffres n'est pas importé, même non reconnu comme total.
  assert.deepEqual(preview.errors.map((e) => e.row), [7]);
});

test("un même NNI deux fois dans le fichier est signalé en erreur", () => {
  const rows: ImportCell[][] = [
    ["Nom", "Prénom", "NNI"],
    ["Diop", "Souley", "1111111111"],
    ["Diop", "Awa", "1111111111"],
  ];
  const preview = buildImportPreview(rows, 0, ["lastName", "firstName", "nni"]);
  assert.equal(preview.students.length, 1);
  assert.equal(preview.errors[0].reason, "NNI déjà présent ligne 2");
});
