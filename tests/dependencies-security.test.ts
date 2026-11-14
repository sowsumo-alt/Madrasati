import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Versions minimales des dépendances qui ont eu des failles graves. Le
 * fichier de verrouillage peut garder une ancienne version même quand
 * package.json en autorise une plus récente : on lit donc la version
 * réellement installée.
 */
const installed = (pkg: string) =>
  (JSON.parse(readFileSync(`node_modules/${pkg}/package.json`, "utf8")) as { version: string }).version;

function atLeast(version: string, minimum: string) {
  const a = version.split(/[.-]/).map(Number);
  const b = minimum.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) > b[i];
  }
  return true;
}

test("Next.js ≥ 15.5.24 : exécution de code à distance corrigée (GHSA-2xp9-vwfh-vxw4, GHSA-p293-qw3h-jr36)", () => {
  const version = installed("next");
  assert.ok(atLeast(version, "15.5.24"), `next ${version} est vulnérable`);
});

test("Next.js ≥ 15.5.29 : exécution de code à distance par l'optimisation d'images SVG et blocage par les actions serveur corrigés (GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r)", () => {
  const version = installed("next");
  assert.ok(atLeast(version, "15.5.29"), `next ${version} est vulnérable`);
});

test("DOMPurify ≥ 3.4.17 (utilisé par la création des PDF)", () => {
  const version = installed("dompurify");
  assert.ok(atLeast(version, "3.4.17"), `dompurify ${version} est vulnérable`);
});
