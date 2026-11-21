import { test } from "node:test";
import assert from "node:assert/strict";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, VerticalMergeType } from "docx";
import { readWordTables } from "../src/lib/word-import";
import {
  fillMerges,
  matchSubject,
  parseCourseCell,
  parseDay,
  parseScheduleRows,
  parseTimeRange,
  suggestClassId,
  type ParsedSlot,
} from "../src/lib/schedule-import";

const SUBJECTS = [
  { id: "ma", name: "Mathématiques", nameAr: "الرياضيات" },
  { id: "fr", name: "Français", nameAr: "الفرنسية" },
  { id: "ar", name: "Arabe", nameAr: "العربية" },
  { id: "pc", name: "Physique-Chimie", nameAr: "الفيزياء والكيمياء" },
  { id: "sn", name: "Sciences Naturelles", nameAr: "العلوم الطبيعية" },
  { id: "hg", name: "Histoire-Géographie", nameAr: null },
  { id: "ir", name: "Instruction Religieuse", nameAr: "التربية الإسلامية" },
  { id: "ic", name: "Instruction Civique", nameAr: null },
  { id: "eps", name: "Éducation Physique et Sportive", nameAr: null },
  { id: "an", name: "Anglais", nameAr: null },
];

const show = (slots: ParsedSlot[]) =>
  slots.map((s) => `${s.dayOfWeek} ${s.startMinutes / 60}-${s.endMinutes / 60} ${s.label}${s.room ? ` @${s.room}` : ""}`);

test("jours : français, arabe, abréviations, en-tête bilingue", () => {
  assert.equal(parseDay("Lundi"), 1);
  assert.equal(parseDay("MARDI"), 2);
  assert.equal(parseDay("Mer."), 3);
  assert.equal(parseDay("الخميس"), 4);
  assert.equal(parseDay("الأحد"), 7);
  assert.equal(parseDay("Samedi السبت"), 6);
  assert.equal(parseDay("Lundi 8h"), null);
  assert.equal(parseDay("Maths"), null);
});

test("horaires : 8h-9h, 08:00 – 10:00, 8h30 à 10h, l'après-midi, heure seule", () => {
  assert.deepEqual(parseTimeRange("8h-9h"), { start: 480, end: 540 });
  assert.deepEqual(parseTimeRange("08:00 – 10:00"), { start: 480, end: 600 });
  assert.deepEqual(parseTimeRange("8h30 à 10h"), { start: 510, end: 600 });
  assert.deepEqual(parseTimeRange("15H-16H"), { start: 900, end: 960 });
  assert.deepEqual(parseTimeRange("3h-4h"), { start: 900, end: 960 }); // personne n'a cours à 3 h du matin
  assert.deepEqual(parseTimeRange("2:00 PM - 3:00 PM"), { start: 840, end: 900 });
  assert.deepEqual(parseTimeRange("8h"), { start: 480, end: null });
  assert.equal(parseTimeRange("3"), null); // un numéro, pas une heure
  assert.equal(parseTimeRange("10h-9h"), null);
  assert.equal(parseTimeRange("Maths"), null);
});

test("cases : salle, pause, case vide", () => {
  assert.deepEqual(parseCourseCell("Maths Salle 3"), { label: "Maths", room: "3" });
  assert.deepEqual(parseCourseCell("PC (S12)"), { label: "PC", room: "12" });
  assert.deepEqual(parseCourseCell("Arabe - salle B"), { label: "Arabe", room: "B" });
  assert.deepEqual(parseCourseCell("Français"), { label: "Français", room: null });
  assert.equal(parseCourseCell("Récréation"), null);
  assert.equal(parseCourseCell("PAUSE"), null);
  assert.equal(parseCourseCell("—"), null);
  assert.equal(parseCourseCell(""), null);
});

test("matières : noms, abréviations, arabe, avec le nom du professeur", () => {
  const m = (label: string) => matchSubject(label, SUBJECTS);
  assert.equal(m("Mathématiques"), "ma");
  assert.equal(m("Maths"), "ma");
  assert.equal(m("MATH"), "ma");
  assert.equal(m("Maths - M. Ba"), "ma");
  assert.equal(m("Fr"), "fr");
  assert.equal(m("PC"), "pc");
  assert.equal(m("Physique"), "pc"); // « Physique-Chimie » avant « Éducation Physique »
  assert.equal(m("SVT"), "sn");
  assert.equal(m("SN"), "sn");
  assert.equal(m("H.G"), "hg");
  assert.equal(m("IR"), "ir");
  assert.equal(m("EPS"), "eps");
  assert.equal(m("Ang"), "an");
  assert.equal(m("العربية"), "ar");
  assert.equal(m("رياضيات"), "ma");
  assert.equal(m("Dessin"), null);
});

test("grille Excel : jours en colonnes, horaires en lignes, pause et cellule fusionnée sur deux heures", () => {
  const rows = [
    ["Emploi du temps — 1AS A"],
    ["Horaire", "Lundi", "Mardi", "Mercredi"],
    ["8h-9h", "Maths", "Français", "PC Salle 2"],
    ["9h-10h", "", "Français", "PC Salle 2"],
    ["10h-10h15", "Récréation", "Récréation", "Récréation"],
    ["10h15-11h15", "Arabe", "", "SVT"],
  ];
  // Maths du lundi fusionnée sur 8h-10h dans le fichier Excel.
  const filled = fillMerges(rows, [{ s: { r: 2, c: 1 }, e: { r: 3, c: 1 } }]);
  const parsed = parseScheduleRows(filled);
  assert.equal(parsed.layout, "days-in-columns");
  assert.deepEqual(show(parsed.slots), [
    "1 8-10 Maths",
    "1 10.25-11.25 Arabe",
    "2 8-10 Français", // deux cases identiques qui se suivent : un cours de deux heures
    "3 8-10 PC @2",
    "3 10.25-11.25 SVT",
  ]);
});

test("grille tournée : jours en lignes, heures seules en colonnes (8h, 9h, 10h)", () => {
  const rows = [
    ["", "8h", "9h", "10h"],
    ["Lundi", "Anglais", "Maths", "HG"],
    ["Mardi", "", "IR", "IR"],
  ];
  const parsed = parseScheduleRows(rows);
  assert.equal(parsed.layout, "days-in-rows");
  assert.deepEqual(show(parsed.slots), ["1 8-9 Anglais", "1 9-10 Maths", "1 10-11 HG", "2 9-11 IR"]);
});

test("liste : une ligne par cours (Jour | Début | Fin | Matière | Salle)", () => {
  const rows = [
    ["Jour", "Heure de début", "Heure de fin", "Matière", "Salle"],
    ["Lundi", "08:00", "09:00", "Mathématiques", "3"],
    ["Lundi", "09:00", "11:00", "Français", ""],
    ["Jeudi", "15h", "16h", "EPS", "Terrain"],
  ];
  const parsed = parseScheduleRows(rows);
  assert.equal(parsed.layout, "list");
  assert.deepEqual(show(parsed.slots), ["1 8-9 Mathématiques @3", "1 9-11 Français", "4 15-16 EPS @Terrain"]);
});

test("rien de reconnaissable : aucun cours, pas d'erreur", () => {
  assert.deepEqual(parseScheduleRows([["N°", "Nom"], ["1", "Ba"]]), { layout: null, slots: [] });
});

test("Word : cellule fusionnée verticalement recopiée (option), liste d'élèves inchangée", async () => {
  const cell = (text: string, verticalMerge?: (typeof VerticalMergeType)[keyof typeof VerticalMergeType]) =>
    new TableCell({ verticalMerge, children: [new Paragraph(text)] });
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph("Emploi du temps 5AF"),
          new Table({
            rows: [
              new TableRow({ children: [cell("Heures"), cell("Lundi"), cell("Mardi")] }),
              new TableRow({ children: [cell("8h-9h"), cell("Arabe", VerticalMergeType.RESTART), cell("Français")] }),
              new TableRow({ children: [cell("9h-10h"), cell("", VerticalMergeType.CONTINUE), cell("Maths")] }),
            ],
          }),
        ],
      },
    ],
  });
  const bytes = new Uint8Array(await Packer.toBuffer(doc));
  const [plain] = readWordTables(bytes);
  assert.equal(plain.rows.at(-1)![1], ""); // comportement d'origine, pour les élèves
  const [table] = readWordTables(bytes, { fillMerged: true });
  assert.deepEqual(show(parseScheduleRows(table.rows).slots), ["1 8-10 Arabe", "2 8-9 Français", "2 9-10 Maths"]);
});

test("classe proposée d'après le titre ou le nom de la feuille, la plus précise", () => {
  const classes = [
    { id: "a", name: "1AS" },
    { id: "b", name: "1AS B" },
    { id: "c", name: "5AF" },
    { id: "d", name: "11AS" },
  ];
  assert.equal(suggestClassId(["EDT 1AS B"], classes), "b");
  assert.equal(suggestClassId(["Feuil1", "Emploi du temps 5 AF"], classes), "c");
  assert.equal(suggestClassId(["11AS"], classes), "d");
  assert.equal(suggestClassId(["Feuil1"], classes), null);
});
