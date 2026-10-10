import { test } from "node:test";
import assert from "node:assert/strict";

import nextConfig from "../next.config";
import { studentSchema } from "../src/app/directeur/eleves/schema";
import { isImageDataUri } from "../src/lib/image-data-uri";

async function headerMap() {
  const rules = (await nextConfig.headers?.()) ?? [];
  const all = rules.find((r) => r.source === "/:path*");
  return new Map((all?.headers ?? []).map((h) => [h.key.toLowerCase(), h.value]));
}

test("en-têtes de sécurité sur toutes les pages (SEC-08)", async () => {
  const h = await headerMap();
  assert.match(h.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.match(h.get("content-security-policy") ?? "", /object-src 'none'/);
  assert.match(h.get("content-security-policy") ?? "", /base-uri 'self'/);
  assert.equal(h.get("x-frame-options"), "DENY");
  assert.equal(h.get("x-content-type-options"), "nosniff");
  assert.equal(h.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(nextConfig.poweredByHeader, false, "X-Powered-By encore envoyé");
});

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDA==";

test("photo d'élève : seule une image encodée est acceptée (SEC-13)", () => {
  assert.ok(isImageDataUri(JPEG));
  assert.ok(isImageDataUri("data:image/png;base64,iVBORw0KGgo="));
  for (const bad of [
    "https://pisteur.example/p.gif",
    "javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "data:image/svg+xml;base64,PHN2Zz4=",
    `${JPEG}" onerror="alert(1)`,
  ]) {
    assert.equal(isImageDataUri(bad), false, bad);
  }
});

test("le formulaire élève refuse une adresse externe et garde photo vide ou encodée", () => {
  const base = { firstName: "Test", lastName: "Eleve", gender: "M", classId: "c1", status: "ACTIVE" };
  const ok = (photoUrl: unknown) => studentSchema.safeParse({ ...base, photoUrl }).success;
  assert.equal(ok("https://pisteur.example/p.gif"), false);
  assert.equal(ok("javascript:alert(1)"), false);
  assert.equal(ok(JPEG), true);
  assert.equal(ok(null), true);
  assert.equal(ok(""), true);
});
