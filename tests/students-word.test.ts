import { test } from "node:test";
import assert from "node:assert/strict";
import { Packer } from "docx";
import { strFromU8, unzipSync } from "fflate";
import { buildStudentsDocument, frenchDate, studentsWordFileName, type StudentsWordData } from "../src/lib/students-word";

const student = (firstName: string, lastName: string, extra: Partial<StudentsWordData["groups"][number]["students"][number]> = {}) => ({
  firstName, lastName, matricule: null, gender: "F", dateOfBirth: "2014-03-09", parentName: "Parent Ba", phone: "22233445566", ...extra,
});

const data: StudentsWordData = {
  schoolName: "École Test",
  yearLabel: "2026-2027",
  filterLabel: "Élèves actifs",
  exportedOn: "2026-11-15",
  groups: [
    { className: "1AS", students: [student("Aïcha", "Ba", { matricule: "26-0001" }), student("Moussa", "Sy", { gender: "M" })] },
    { className: "Sans classe", students: [student("محمد", "ولد أحمد")] },
  ],
};

async function documentXml(d: StudentsWordData) {
  const buffer = await Packer.toBuffer(buildStudentsDocument(d));
  return strFromU8(unzipSync(new Uint8Array(buffer))["word/document.xml"]);
}

test("un vrai fichier Word : une page par classe, tous les élèves, en-tête répété", async () => {
  const xml = await documentXml(data);
  for (const text of ["Liste des élèves — 1AS", "Liste des élèves — Sans classe", "Aïcha", "26-0001", "Moussa", "محمد", "09/03/2014", "22233445566", "2 élèves · Élèves actifs", "1 élève · Élèves actifs", "École Test — Année scolaire 2026-2027"]) {
    assert.ok(xml.includes(text), `absent du document : ${text}`);
  }
  // Deux classes → deux sections (nouvelle page) ; l'en-tête du tableau se répète en haut de page.
  assert.equal((xml.match(/<w:sectPr/g) ?? []).length, 2);
  assert.ok(xml.includes("<w:tblHeader/>") || xml.includes("<w:tblHeader "), "en-tête du tableau non répété");
  assert.ok(xml.indexOf("Liste des élèves — 1AS") < xml.indexOf("Liste des élèves — Sans classe"));
  assert.match(xml, /<w:t[^>]*>G<\/w:t>/, "garçon : G");
});

test("dates françaises, nom du fichier", () => {
  assert.equal(frenchDate("2014-03-09"), "09/03/2014");
  assert.equal(frenchDate(null), "");
  assert.equal(studentsWordFileName(data), "liste-eleves-2026-11-15.docx");
  assert.equal(studentsWordFileName({ ...data, groups: [data.groups[0]] }), "liste-eleves-1as-2026-11-15.docx");
  assert.equal(studentsWordFileName({ ...data, groups: [{ className: "6ème Année A", students: [] }] }), "liste-eleves-6eme-annee-a-2026-11-15.docx");
});
