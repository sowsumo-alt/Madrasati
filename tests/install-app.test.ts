import { test } from "node:test";
import assert from "node:assert/strict";
import manifest from "../src/app/manifest";
import nextConfig from "../next.config";
import { browserKind } from "../src/lib/install-prompt";
import { dictionaries } from "../src/lib/i18n/dictionaries";

const UA = {
  chromeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  edgeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  firefoxWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
  safariMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
};

test("le bon geste d'installation selon le navigateur", () => {
  assert.equal(browserKind(UA.chromeWindows), "chromium");
  assert.equal(browserKind(UA.edgeWindows), "chromium");
  assert.equal(browserKind(UA.firefoxWindows), "firefox");
  assert.equal(browserKind(UA.safariMac), "safari-mac");
  assert.equal(browserKind(UA.safariMac, 5), "ios", "un iPad se présente comme un Mac, mais tactile");
  assert.equal(browserKind(UA.iphone), "ios");
});

test("manifeste installable sur ordinateur : nom, fenêtre à part, icônes 192 et 512", () => {
  const m = manifest();
  assert.equal(m.id, "/");
  assert.equal(m.start_url, "/");
  assert.equal(m.display, "standalone");
  assert.ok(m.short_name);
  const sizes = (m.icons ?? []).filter((i) => i.purpose === "any").map((i) => i.sizes);
  assert.ok(sizes.includes("192x192") && sizes.includes("512x512"));
});

test("textes d'installation dans les trois langues", () => {
  for (const lang of ["fr", "en", "ar"] as const) {
    const dict = dictionaries[lang] as Record<string, string>;
    for (const key of ["header.installApp", "install.title", "install.intro", "install.chromium", "install.safariMac", "install.ios", "install.firefox", "install.other"]) {
      assert.ok(dict[key], `${lang} : ${key}`);
    }
  }
});

test("le manifeste est annoncé dans <head> pour Chrome et Edge, pas en fin de page", () => {
  const limited = nextConfig.htmlLimitedBots;
  assert.ok(limited instanceof RegExp, "htmlLimitedBots absent : Next.js met les métadonnées dans <body>");
  assert.ok(limited.test(UA.chromeWindows) && limited.test(UA.edgeWindows) && limited.test(UA.safariMac));
});
