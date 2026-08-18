import fs from "node:fs";

/**
 * Branche un composant client sur le dictionnaire : ajoute l'import du hook et
 * la déstructuration de `t`, si elles manquent. Sans ça, un appel à t() inséré
 * dans le fichier ne compile pas.
 */
for (const file of process.argv.slice(2)) {
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("useLanguage")) {
    console.log(`${file} : déjà branché`);
    continue;
  }
  if (!src.startsWith('"use client"')) {
    console.log(`${file} : COMPOSANT SERVEUR — utiliser getTranslations()`);
    continue;
  }

  const lastImport = [...src.matchAll(/^import .*;$/gm)].pop();
  if (!lastImport) {
    console.log(`${file} : aucun import trouvé`);
    continue;
  }
  src =
    src.slice(0, lastImport.index + lastImport[0].length) +
    '\nimport { useLanguage } from "@/lib/i18n/language-provider";' +
    src.slice(lastImport.index + lastImport[0].length);

  // Première ligne du corps du composant exporté.
  const body = src.match(/^export function \w+\([\s\S]*?\n\) \{\n|^export function \w+\([^)]*\) \{\n/m);
  if (!body) {
    console.log(`${file} : corps du composant introuvable — hook à poser à la main`);
    fs.writeFileSync(file, src);
    continue;
  }
  const at = body.index + body[0].length;
  src = src.slice(0, at) + "  const { t } = useLanguage();\n" + src.slice(at);

  fs.writeFileSync(file, src);
  console.log(`${file} : branché`);
}
