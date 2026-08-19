import fs from "node:fs";
import path from "node:path";

/**
 * Repère les textes visibles écrits en dur dans le JSX, donc invisibles au
 * dictionnaire de traduction. Heuristique volontairement large : mieux vaut
 * signaler une ligne à écarter à la main qu'en manquer une.
 */

const FR =
  /[àâäéèêëîïôöùûüçœÀÂÄÉÈÊËÎÏÔÖÙÛÜÇŒ]|\b(le|la|les|des|du|une|un|aucun|aucune|pour|avec|dans|sur|par|sans|est|sont|vous|votre|vos|cette|ce|cet|ces|et|ou|plus|tous|toutes|encore|jamais|quand|dont)\b/i;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function scan(file) {
  const found = [];
  const raw = fs.readFileSync(file, "utf8");

  // Les commentaires sont du texte français légitime : les retirer d'abord,
  // sinon chaque explication de code ressort comme une chaîne à traduire.
  const src = raw
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));

  const lineAt = (index) => src.slice(0, index).split("\n").length;

  const push = (txt, index) => {
    const clean = txt.replace(/\s+/g, " ").trim();
    if (clean.length < 4) return;
    if (!FR.test(clean)) return;
    if (/^[\d\s.,:;/%-]+$/.test(clean)) return;
    found.push({ line: lineAt(index), txt: clean.slice(0, 72) });
  };

  // Texte JSX, y compris réparti sur plusieurs lignes. On exclut { } pour ne
  // pas ramasser d'expression, et on ignore ce qui contient un appel à t().
  for (const m of src.matchAll(/>([^<>{}]{4,}?)</g)) {
    if (/\bt\(/.test(m[1])) continue;
    push(m[1], m.index);
  }

  // Attributs visibles par l'utilisateur.
  for (const m of src.matchAll(/(?:placeholder|title|aria-label)="([^"]{4,})"/g)) {
    push(m[1], m.index);
  }

  // Chaînes littérales dans du code d'affichage : toasts, messages d'erreur,
  // libellés construits. Elles ne passent jamais par le dictionnaire non plus.
  for (const m of src.matchAll(/(?:toast\.\w+|Error)\(\s*"([^"]{6,})"/g)) {
    push(m[1], m.index);
  }

  return found;
}

/**
 * Le tableau de bord Super Admin est hors périmètre : il n'a qu'un seul
 * utilisateur, l'éditeur, qui travaille en français. Le traduire serait du
 * travail pour personne, et le compter fausserait la mesure de ce qui reste
 * réellement à faire côté écoles. `--tout` le réintègre si besoin.
 */
const OUT_OF_SCOPE = ["src/app/super-admin/"];

const args = process.argv.slice(2);
const includeAll = args.includes("--tout");
const filter = args.find((a) => !a.startsWith("--")) ?? "";

const results = [];
for (const file of walk("src")) {
  const rel = file.split(path.sep).join("/");
  if (!includeAll && OUT_OF_SCOPE.some((p) => rel.startsWith(p))) continue;
  if (filter && !rel.includes(filter)) continue;
  const found = scan(file);
  if (found.length) results.push({ rel, found });
}

results.sort((a, b) => b.found.length - a.found.length);
const total = results.reduce((s, r) => s + r.found.length, 0);
console.log(`${total} texte(s) en dur dans ${results.length} fichier(s)\n`);

const detail = Boolean(filter);
for (const r of results) {
  console.log(`${String(r.found.length).padStart(3)}  ${r.rel}`);
  if (detail) for (const f of r.found) console.log(`       L${f.line}: ${f.txt}`);
}
