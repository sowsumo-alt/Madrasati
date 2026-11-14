import { test } from "node:test";
import assert from "node:assert/strict";
import { Document, Packer, Paragraph, Tab, Table, TableCell, TableRow, TabStopType, TextRun } from "docx";
import { zipSync, strToU8 } from "fflate";
import { readWordTables } from "../src/lib/word-import";
import { analyzeImportRows, buildImportPreview } from "../src/lib/student-import";

const cell = (text: string, columnSpan?: number) => new TableCell({ columnSpan, children: [new Paragraph(text)] });
const table = (rows: (string | [string, number])[][]) =>
  new Table({ rows: rows.map((r) => new TableRow({ children: r.map((c) => (Array.isArray(c) ? cell(c[0], c[1]) : cell(c))) })) });

async function docx(children: (Paragraph | Table)[]) {
  return new Uint8Array(await Packer.toBuffer(new Document({ sections: [{ children }] })));
}

/** Comme la fenêtre d'import : colonnes reconnues, puis la liste des élèves. */
function importOf(rows: ReturnType<typeof readWordTables>[number]["rows"]) {
  const analysis = analyzeImportRows(rows);
  return { ...analysis, preview: buildImportPreview(rows, analysis.headerRow, analysis.mapping) };
}

test("liste Word typique : titre de classe, tableau N° / Prénoms et Nom / Date de naissance / Sexe", async () => {
  const bytes = await docx([
    new Paragraph("École Al Ibdaa — Année 2026-2027"),
    new Paragraph("JARDIN"),
    table([
      ["N°", "Prénoms et Nom", "Date de naissance", "Sexe"],
      ["1", "Aïcha Ba", "09/03/2021", "F"],
      ["2", "Mohamed Salem Ould Ahmed", "15/11/2020", "G"],
      ["3", "محمد ولد سيدي", "02/01/2021", "M"],
      ["", "Effectif : 3", "", ""],
    ]),
  ]);
  const [first] = readWordTables(bytes);
  const { title, mapping, preview } = importOf(first.rows);
  assert.equal(title, "JARDIN", "le titre au-dessus du tableau propose la classe");
  assert.ok(mapping.includes("fullName") && mapping.includes("dateOfBirth") && mapping.includes("gender"));
  // Même découpage du nom complet que pour un fichier Excel (« Ould Ahmed » reste le nom de famille).
  assert.deepEqual(
    preview.students.map((s) => [s.firstName, s.lastName, s.dateOfBirth, s.gender]),
    [
      ["Aïcha", "Ba", "2021-03-09", "F"],
      ["Mohamed Salem", "Ould Ahmed", "2020-11-15", "M"],
      ["محمد ولد", "سيدي", "2021-01-02", "M"],
    ],
  );
  assert.equal(preview.ignored.length, 1, "la ligne d'effectif est laissée de côté");
});

test("plusieurs tableaux : la liste d'élèves passe en premier, l'autre reste au choix", async () => {
  const bytes = await docx([
    table([
      ["Directeur", "M. Sy"],
      ["Téléphone", "22233445566"],
    ]),
    new Paragraph("Classe 1AS"),
    table([
      ["Nom", "Prénom", "Sexe"],
      ["Ba", "Aïcha", "F"],
      ["Sy", "Moussa", "M"],
    ]),
  ]);
  const tables = readWordTables(bytes);
  assert.equal(tables.length, 2);
  assert.match(tables[0].label, /^Tableau 1 : Classe 1AS — 2 ligne\(s\)$/);
  const { preview } = importOf(tables[0].rows);
  assert.deepEqual(preview.students.map((s) => `${s.firstName} ${s.lastName}`), ["Aïcha Ba", "Moussa Sy"]);
});

test("cellule fusionnée sur deux colonnes : les colonnes suivantes restent à leur place", async () => {
  const bytes = await docx([
    table([
      ["Nom", "Prénom", ["Naissance", 2], "Sexe"],
      ["", "", "Date", "Lieu", ""],
      ["Ba", "Aïcha", "09/03/2014", "Nouakchott", "F"],
    ]),
  ]);
  const [first] = readWordTables(bytes);
  assert.deepEqual(first.rows[0], ["Nom", "Prénom", "Naissance", "", "Sexe"]);
  assert.deepEqual(first.rows[2], ["Ba", "Aïcha", "09/03/2014", "Nouakchott", "F"]);
});

test("sans tableau : une ligne par paragraphe, colonnes aux tabulations (pas aux taquets)", async () => {
  const line = (...cells: string[]) =>
    new Paragraph({
      tabStops: [{ type: TabStopType.LEFT, position: 3000 }, { type: TabStopType.LEFT, position: 6000 }],
      children: cells.flatMap((c, i) => (i === 0 ? [new TextRun(c)] : [new TextRun({ children: [new Tab(), c] })])),
    });
  const bytes = await docx([line("Nom", "Prénom", "Sexe"), line("Ba", "Aïcha", "F"), line("Sy & fils", "Moussa", "M")]);
  const [only] = readWordTables(bytes);
  assert.match(only.label, /^Texte du document : 3 ligne\(s\)$/);
  assert.deepEqual(only.rows, [["Nom", "Prénom", "Sexe"], ["Ba", "Aïcha", "F"], ["Sy & fils", "Moussa", "M"]]);
  assert.equal(importOf(only.rows).preview.students.length, 2);
});

test("un fichier qui n'est pas un Word est refusé", () => {
  assert.throws(() => readWordTables(strToU8("pas un zip")));
  assert.throws(() => readWordTables(zipSync({ "xl/workbook.xml": strToU8("<x/>") })), /Pas un document Word/);
});
