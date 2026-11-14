/**
 * Liste des élèves en Word (.docx) : une page par classe, un tableau par
 * page (N°, matricule, nom, prénom, sexe, naissance, parent, téléphone),
 * l'en-tête du tableau répété si la classe déborde sur une autre page.
 */
import {
  AlignmentType,
  Document,
  Footer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

export interface WordStudentRow {
  firstName: string;
  lastName: string;
  matricule: string | null;
  gender: string | null;
  /** « AAAA-MM-JJ » ou null. */
  dateOfBirth: string | null;
  parentName: string;
  phone: string;
}

export interface WordClassGroup {
  className: string;
  students: WordStudentRow[];
}

export interface StudentsWordData {
  schoolName: string;
  yearLabel: string | null;
  /** Filtres appliqués à la liste (« Élèves actifs · Recherche « ba » »), ou null. */
  filterLabel: string | null;
  /** « AAAA-MM-JJ ». */
  exportedOn: string;
  groups: WordClassGroup[];
}

const GREEN = "0B5E38";
// A4 portrait, marges de 1,27 cm : 10 466 twips de large pour le tableau.
const MARGIN = 720;
const COLUMNS: { label: string; width: number }[] = [
  { label: "N°", width: 520 },
  { label: "Matricule", width: 1250 },
  { label: "Nom", width: 1800 },
  { label: "Prénom", width: 1800 },
  { label: "Sexe", width: 620 },
  { label: "Né(e) le", width: 1200 },
  { label: "Parent", width: 1876 },
  { label: "Téléphone", width: 1400 },
];

/** « 2014-03-09 » → « 09/03/2014 ». */
export const frenchDate = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

const genderLabel = (gender: string | null) => (gender === "M" ? "G" : gender === "F" ? "F" : "");

function cell(text: string, { header = false, width, center = false }: { header?: boolean; width: number; center?: boolean }) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: header ? { type: ShadingType.CLEAR, fill: "E3EFE8", color: "auto" } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text, bold: header, color: header ? GREEN : undefined })],
      }),
    ],
  });
}

function classTable(students: WordStudentRow[]) {
  const header = new TableRow({
    tableHeader: true,
    children: COLUMNS.map((c, i) => cell(c.label, { header: true, width: c.width, center: i === 0 || i === 4 })),
  });
  const rows = students.map(
    (s, index) =>
      new TableRow({
        cantSplit: true,
        children: [
          String(index + 1),
          s.matricule ?? "",
          s.lastName,
          s.firstName,
          genderLabel(s.gender),
          frenchDate(s.dateOfBirth),
          s.parentName,
          s.phone,
        ].map((text, i) => cell(text, { width: COLUMNS[i].width, center: i === 0 || i === 4 })),
      }),
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: COLUMNS.map((c) => c.width),
    layout: TableLayoutType.FIXED,
    rows: [header, ...rows],
  });
}

const plural = (n: number) => `${n} élève${n > 1 ? "s" : ""}`;

/** Le document : une section (donc une nouvelle page) par classe. */
export function buildStudentsDocument(data: StudentsWordData): Document {
  const school = [data.schoolName, data.yearLabel ? `Année scolaire ${data.yearLabel}` : null].filter(Boolean).join(" — ");
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: `${data.schoolName} — liste exportée le ${frenchDate(data.exportedOn)} — page `, size: 16, color: "666666" }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "666666" }),
        ],
      }),
    ],
  });

  const groups = data.groups.length > 0 ? data.groups : [{ className: "", students: [] }];
  return new Document({
    creator: "Madrasati",
    title: `Liste des élèves — ${data.schoolName}`,
    styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
    sections: groups.map((group) => ({
      properties: { page: { margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN } } },
      footers: { default: footer },
      children: [
        new Paragraph({ children: [new TextRun({ text: school, bold: true, size: 22, color: GREEN })] }),
        new Paragraph({
          spacing: { before: 200, after: 80 },
          children: [new TextRun({ text: group.className ? `Liste des élèves — ${group.className}` : "Liste des élèves", bold: true, size: 32 })],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: [plural(group.students.length), data.filterLabel].filter(Boolean).join(" · "),
              color: "555555",
            }),
          ],
        }),
        group.students.length > 0
          ? classTable(group.students)
          : new Paragraph({ children: [new TextRun({ text: "Aucun élève dans cette liste.", italics: true })] }),
      ],
    })),
  });
}

/** Nom du fichier : « liste-eleves-1as-2026-11-15.docx », « liste-eleves-2026-11-15.docx ». */
export function studentsWordFileName(data: StudentsWordData): string {
  const only = data.groups.length === 1 ? data.groups[0].className : "";
  const slug = only
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `liste-eleves${slug ? `-${slug}` : ""}-${data.exportedOn}.docx`;
}
