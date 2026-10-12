// Génère src/app/theme-dark.css : le mode sombre de l'application des écoles.
//
// Principe (une seule source de couleurs, aucun écran à réécrire) :
// - les couleurs de fond pâles (50 à 300) deviennent des teintes sombres ;
// - les couleurs de texte foncées (600 à 950) deviennent claires ;
// - les couleurs pleines (boutons, bandeaux : bg-, from-, via-, to- de 600 à
//   950) gardent leur teinte d'origine, pour que le texte blanc reste lisible ;
// - les documents ([data-paper] : reçus, bulletins, fiches de paie…) restent
//   clairs comme du papier ; l'impression aussi (@media screen).
//
// Relancer après avoir utilisé une nouvelle couleur pleine dans le code :
//   node scripts/build-dark-theme.mjs
// (tests/dark-theme.test.ts échoue tant que ce n'est pas fait).

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCOPE = ':root:has([data-app-theme="dark"])';
const DARK_SURFACE = "#0c1814";

// — Couleurs d'origine : palette Tailwind et couleurs Madrasati (globals.css).
const palette = {};
for (const m of readFileSync(path.join(ROOT, "node_modules/tailwindcss/theme.css"), "utf8").matchAll(
  /--color-([a-z]+)-(\d+):\s*([^;]+);/g,
)) {
  (palette[m[1]] ??= {})[m[2]] = m[3].trim();
}
const globals = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
const rootBlock = globals.slice(globals.indexOf(":root {"), globals.indexOf("}", globals.indexOf(":root {")));
const brand = {};
for (const m of rootBlock.matchAll(/--(primary|accent)-(\d+):\s*([^;]+);/g)) (brand[m[1]] ??= {})[m[2]] = m[3].trim();

// — Couleurs réellement employées dans le code.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name) && !name.startsWith("theme-dark")) out.push(p);
  }
  return out;
}
const source = walk(path.join(ROOT, "src")).map((f) => readFileSync(f, "utf8")).join("\n");
const ALL = { ...palette, ...brand };
const families = Object.keys(ALL).filter((fam) =>
  new RegExp(`[a-z]-${fam}-(50|100|200|300|400|500|600|700|800|900|950)\\b`).test(source),
);

// Variable d'une couleur : --primary-700 pour Madrasati, --color-amber-700 sinon.
const varOf = (fam, shade) => (brand[fam] ? `--${fam}-${shade}` : `--color-${fam}-${shade}`);
const orig = (fam, shade) => ALL[fam]?.[shade];

// — 1. Palette remappée en mode sombre.
const DARK_MAP = { 50: 14, 100: 22, 200: 32, 300: 48 }; // % de la teinte 500 sur la surface sombre
const LIGHTER = { 600: "400", 700: "300", 800: "200", 900: "100", 950: "50" };
const remap = [];
for (const fam of families) {
  const base = orig(fam, "500") ?? orig(fam, "600");
  for (const [shade, pct] of Object.entries(DARK_MAP)) {
    if (orig(fam, shade) && base) remap.push(`  ${varOf(fam, shade)}: color-mix(in oklab, ${base} ${pct}%, ${DARK_SURFACE});`);
  }
  for (const [shade, to] of Object.entries(LIGHTER)) {
    if (orig(fam, shade) && orig(fam, to)) remap.push(`  ${varOf(fam, shade)}: ${orig(fam, to)};`);
  }
}

// — 2. Couleurs pleines employées : teinte d'origine conservée.
const escape = (cls) => cls.replace(/([:/[\]=.])/g, "\\$1");
const solidRe = /(?<![\w-])((?:hover:|group-hover:)?)(bg|from|via|to)-([a-z]+)-(600|700|800|900|950)(?![\w/-])/g;
const solids = new Map();
for (const m of source.matchAll(solidRe)) {
  const [, prefix, kind, fam, shade] = m;
  if (!orig(fam, shade)) continue;
  solids.set(`${prefix}${kind}-${fam}-${shade}`, { prefix, kind, fam, shade });
}
const PROP = { bg: "background-color", from: "--tw-gradient-from", via: "--tw-gradient-via", to: "--tw-gradient-to" };
const solidRules = [...solids.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([cls, { prefix, kind, fam, shade }]) => {
    const sel =
      prefix === "hover:"
        ? `.${escape(cls)}:hover`
        : prefix === "group-hover:"
          ? `.${escape(cls)}:is(:where(.group):hover *)`
          : `.${escape(cls)}`;
    return `  ${SCOPE} ${sel} { ${PROP[kind]}: ${orig(fam, shade)}; }`;
  });

// — 3. Papier : toutes les couleurs d'origine.
const paper = [];
for (const fam of families) {
  for (const shade of Object.keys(ALL[fam])) paper.push(`    ${varOf(fam, shade)}: ${orig(fam, shade)};`);
}

const css = `/* Généré par scripts/build-dark-theme.mjs — ne pas modifier à la main.
   Mode sombre de l'application des écoles (choisi par le bouton soleil/lune
   de l'en-tête). Écran seulement : l'impression reste claire. */

@media screen {
  ${SCOPE} {
    color-scheme: dark;
    --background: #06100d;
    --foreground: #e6eeea;
    --surface: ${DARK_SURFACE};
    --surface-muted: #13231d;
    --border: #2a3f37;
    --success: #34d399;
    --warning: #fbbf24;
    --danger: #f87171;
${remap.map((l) => "  " + l).join("\n")}
  }

  /* Couleurs pleines (boutons, bandeaux) : teinte d'origine, texte blanc lisible. */
${solidRules.join("\n")}

  /* Barre latérale et fond, comme la maquette « Tableau de bord en mode sombre ». */
  ${SCOPE} .app-sidebar { background: #08130f; border-inline-end: 1px solid #1a2b25; }
  ${SCOPE} .app-bg { opacity: 0.06; }

  /* Zones déjà foncées (barre latérale, bandeau d'accueil) : couleurs d'origine. */
  ${SCOPE} [data-keep-colors] {
${paper.join("\n")}
  }

  /* Documents (reçus, bulletins, fiches de paie, feuilles de notes) : papier clair. */
  ${SCOPE} [data-paper] {
    color-scheme: light;
    --background: #f7f8f6;
    --foreground: #1a2420;
    --surface: #ffffff;
    --surface-muted: #eef1ee;
    --border: #b9c6bf;
    --success: #178a5c;
    --warning: #c2861a;
    --danger: #b23b3b;
${paper.join("\n")}
    color: var(--foreground);
  }
}
`;
writeFileSync(path.join(ROOT, "src/app/theme-dark.css"), css);
console.log(`theme-dark.css : ${families.length} familles, ${solidRules.length} couleurs pleines, ${css.length} octets`);
