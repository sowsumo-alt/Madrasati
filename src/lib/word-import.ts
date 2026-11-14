/**
 * Listes d'élèves tapées dans Word (.docx) : on lit les tableaux du document,
 * ligne par ligne et cellule par cellule, pour les passer au même import que
 * les fichiers Excel (reconnaissance des colonnes, aperçu, confirmation).
 * Sans tableau, chaque paragraphe devient une ligne, découpée aux tabulations.
 *
 * Sans dépendance au navigateur : testé tel quel (tests/word-import.test.ts).
 */
import { strFromU8, unzipSync } from "fflate";
import { findHeaderRow, type ImportCell } from "./student-import";

export interface WordTable {
  /** Lignes prêtes pour l'import : le titre au-dessus du tableau, puis le tableau. */
  rows: ImportCell[][];
  /** Ce que le directeur voit pour choisir entre plusieurs tableaux. */
  label: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITIES[e.toLowerCase()],
  );
const clean = (text: string) => text.replace(/[  ]+/g, " ").trim();

type Block = { kind: "paragraph"; text: string } | { kind: "table"; rows: string[][] };

/** Le corps du document, dans l'ordre : paragraphes et tableaux (les tableaux imbriqués restent dans leur cellule). */
export function documentBlocks(xml: string): Block[] {
  const blocks: Block[] = [];
  const TOKEN = /<(\/?)w:(tbl|tr|tc|p|t|tabs|tab|br|cr|gridSpan)\b([^>]*?)(\/?)>|<[^>]*>|([^<]+)/g;
  let depth = 0; // tableaux ouverts
  let rows: string[][] = [];
  let row: string[] = [];
  let cell: string[] = [];
  let span = 1;
  let paragraph = "";
  let inText = false;
  let inTabStops = false; // <w:tabs> : positions des tabulations, pas du texte

  for (const m of xml.matchAll(TOKEN)) {
    const [, closing, tag, attrs, selfClosing, text] = m;
    if (text !== undefined) {
      if (inText) paragraph += decode(text);
      continue;
    }
    if (!tag) continue;
    if (tag === "t") {
      inText = !closing && !selfClosing;
    } else if (tag === "tabs") {
      inTabStops = !closing && !selfClosing;
    } else if (tag === "tab") {
      if (!inTabStops) paragraph += "\t";
    } else if (tag === "br" || tag === "cr") {
      paragraph += " ";
    } else if (tag === "p" && (closing || selfClosing)) {
      if (depth === 0) blocks.push({ kind: "paragraph", text: paragraph });
      else cell.push(paragraph);
      paragraph = "";
    } else if (tag === "tbl") {
      if (!closing) {
        depth++;
        if (depth === 1) rows = [];
      } else if (--depth === 0) {
        blocks.push({ kind: "table", rows });
      }
    } else if (depth === 1 && tag === "tr") {
      if (!closing) row = [];
      else rows.push(row);
    } else if (depth === 1 && tag === "tc") {
      if (!closing) {
        cell = [];
        span = 1;
      } else {
        // Une cellule fusionnée sur plusieurs colonnes garde les suivantes à leur place.
        row.push(clean(cell.join(" ").replace(/\t/g, " ")), ...Array<string>(span - 1).fill(""));
      }
    } else if (depth === 1 && tag === "gridSpan") {
      span = Math.max(1, Number(/w:val="(\d+)"/.exec(attrs)?.[1] ?? 1));
    }
  }
  return blocks;
}

const nonEmpty = (rows: string[][]) => rows.filter((r) => r.some(Boolean));

/** Les tableaux de la liste, le plus probable en premier (en-têtes reconnus, puis le plus long). */
export function wordTables(xml: string): WordTable[] {
  const blocks = documentBlocks(xml);
  const tables: (WordTable & { score: number })[] = [];
  blocks.forEach((block, index) => {
    if (block.kind !== "table") return;
    const body = nonEmpty(block.rows);
    if (body.length < 2) return;
    // Les quelques lignes écrites juste au-dessus : le titre (souvent la classe).
    const above: string[] = [];
    for (let i = index - 1; i >= 0 && above.length < 3; i--) {
      const b = blocks[i];
      if (b.kind === "table") break;
      if (clean(b.text)) above.unshift(clean(b.text));
    }
    const header = findHeaderRow(body);
    const title = above[above.length - 1];
    tables.push({
      rows: [...above.map((t) => [t]), ...body],
      label: `${title ? `${title} — ` : ""}${body.length - (header >= 0 ? header + 1 : 0)} ligne(s)`,
      score: (header >= 0 ? 1_000_000 : 0) + body.length,
    });
  });
  if (tables.length > 0) {
    const sorted = tables
      .map((t, order) => ({ ...t, order }))
      .sort((a, b) => b.score - a.score || a.order - b.order);
    return sorted.map(({ rows, label }, i) => ({ rows, label: `Tableau ${i + 1} : ${label}` }));
  }
  // Pas de tableau : une ligne par paragraphe, colonnes aux tabulations.
  const lines = blocks
    .filter((b): b is { kind: "paragraph"; text: string } => b.kind === "paragraph")
    .map((b) => b.text.split("\t").map(clean))
    .filter((r) => r.some(Boolean));
  return lines.length > 0 ? [{ rows: lines, label: `Texte du document : ${lines.length} ligne(s)` }] : [];
}

/** Le fichier .docx entier → ses tableaux. Lève une erreur si ce n'est pas un .docx lisible. */
export function readWordTables(bytes: Uint8Array): WordTable[] {
  const files = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" });
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("Pas un document Word (.docx)");
  return wordTables(strFromU8(xml));
}
