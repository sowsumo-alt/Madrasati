import { test } from "node:test";
import assert from "node:assert/strict";

import { isChunkLoadError } from "../src/lib/chunk-error";

/**
 * Seules les erreurs de chargement de fichier déclenchent le rechargement
 * automatique : recharger sur n'importe quelle erreur masquerait les vraies
 * pannes et pourrait tourner en boucle.
 */

test("reconnaît un fichier de l'ancienne version introuvable", () => {
  const webpack = new Error("Loading chunk 4521 failed.");
  webpack.name = "ChunkLoadError";
  assert.equal(isChunkLoadError(webpack), true);
  assert.equal(isChunkLoadError(new Error("Loading CSS chunk 12 failed")), true);
  assert.equal(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /x.js")), true);
  assert.equal(isChunkLoadError(new TypeError("Importing a module script failed.")), true);
});

test("ignore les autres erreurs", () => {
  assert.equal(isChunkLoadError(new TypeError("Cannot read properties of undefined")), false);
  assert.equal(isChunkLoadError("Loading chunk 1 failed"), false);
  assert.equal(isChunkLoadError(null), false);
});
