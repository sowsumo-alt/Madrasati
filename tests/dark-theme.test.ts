import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { appThemeOf } from "../src/lib/app-theme";

const css = readFileSync(path.join(process.cwd(), "src/app/theme-dark.css"), "utf8");

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(name)) out.push(readFileSync(p, "utf8"));
  }
  return out;
}

test("thème clair par défaut ; sombre seulement sur choix", () => {
  assert.equal(appThemeOf(undefined), "light");
  assert.equal(appThemeOf("n'importe quoi"), "light");
  assert.equal(appThemeOf("dark"), "dark");
});

test("mode sombre à l'écran seulement : l'impression reste claire", () => {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  assert.ok(body.startsWith("@media screen {"), "les règles sombres doivent être dans @media screen");
  assert.ok(body.endsWith("}"));
});

test("chaque couleur pleine du code (bouton, bandeau) garde sa teinte en mode sombre", () => {
  // Sans cela, un bouton vert à texte blanc devenait vert pâle, texte illisible.
  // Échec ? Relancer : node scripts/build-dark-theme.mjs
  const code = sources(path.join(process.cwd(), "src")).join("\n");
  const used = new Set(
    [...code.matchAll(/(?<![\w-])((?:hover:|group-hover:)?(?:bg|from|via|to)-[a-z]+-(?:600|700|800|900|950))(?![\w/-])/g)].map((m) => m[1]),
  );
  const missing = [...used].filter((cls) => {
    const family = cls.replace(/^(hover:|group-hover:)?(bg|from|via|to)-/, "").replace(/-\d+$/, "");
    if (["white", "black", "transparent", "current"].includes(family)) return false;
    return !css.includes(`.${cls.replace(/([:/[\]=.])/g, "\\$1")}`);
  });
  assert.deepEqual(missing, []);
});

test("documents (reçus, bulletins, paie, feuilles de notes) toujours clairs, PDF compris", () => {
  assert.match(css, /\[data-paper\] \{[^}]*--surface: #ffffff;/);
  const code = sources(path.join(process.cwd(), "src")).join("\n");
  for (const marker of ['data-testid="compact-receipt" data-paper', 'id="bulletin-salaire"\n        data-paper', 'data-testid="mark-sheet-page" data-paper']) {
    assert.ok(code.replace(/\r\n/g, "\n").includes(marker), `document non marqué : ${marker}`);
  }
  const pdf = readFileSync(path.join(process.cwd(), "src/lib/pdf-export.ts"), "utf8");
  assert.equal(pdf.match(/setAttribute\("data-app-theme", "light"\)/g)?.length, 2, "les deux captures PDF doivent forcer le clair");
});
