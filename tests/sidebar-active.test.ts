import { test } from "node:test";
import assert from "node:assert/strict";
import { isActive } from "../src/components/layout/sidebar";
import { navGroupsByRole } from "../src/components/layout/nav-items";

const hrefs = navGroupsByRole.director.flatMap((group) => group.items.map((item) => item.href));
const lit = (pathname: string) => hrefs.filter((href) => isActive(pathname, href, hrefs));

test("une seule entrée allumée : « Paiements par classe » n'allume pas « Paiements »", () => {
  assert.deepEqual(lit("/directeur/finance/par-classe"), ["/directeur/finance/par-classe"]);
  assert.deepEqual(lit("/directeur/finance"), ["/directeur/finance"]);
  assert.deepEqual(lit("/directeur/finance/recus/abc"), ["/directeur/finance"]);
});
