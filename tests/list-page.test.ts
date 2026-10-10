import { test } from "node:test";
import assert from "node:assert/strict";

import { listHref, pageOf, pageParam, textParam } from "../src/lib/list-page";

test("page lue dans l'adresse : invalide ou trop loin, on revient dans les bornes", () => {
  assert.equal(pageParam("3"), 3);
  assert.equal(pageParam(undefined), 1);
  assert.equal(pageParam("-2"), 1);
  assert.equal(pageParam(["4", "5"]), 4);
  assert.equal(textParam("x".repeat(500)).length, 100);

  const items = Array.from({ length: 45 }, (_, i) => i);
  assert.deepEqual(pageOf(items, 1, 20).rows, items.slice(0, 20));
  assert.deepEqual(pageOf(items, 3, 20), { rows: items.slice(40), total: 45, page: 3, pageCount: 3 });
  assert.equal(pageOf(items, 99, 20).page, 3);
  assert.deepEqual(pageOf([], 2, 20), { rows: [], total: 0, page: 1, pageCount: 1 });
});

test("adresse d'une liste : valeurs par défaut omises", () => {
  assert.equal(listHref("/directeur/parents", { q: "", page: 1 }), "/directeur/parents");
  assert.equal(listHref("/directeur/parents", { q: "Diallo", page: 2 }), "/directeur/parents?q=Diallo&page=2");
});
