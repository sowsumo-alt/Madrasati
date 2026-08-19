import fs from "node:fs";

/**
 * Branche un composant client sur le dictionnaire : ajoute l'import du hook et
 * la déstructuration de `t`, si elles manquent. Sans ça, un appel à t() inséré
 * dans le fichier ne compile pas.
 */
for (const file of process.argv.slice(2)) {
  let src = fs.readFileSync(file, "utf8");
  // On teste l'import et le hook séparément : une exécution interrompue peut
  // avoir posé l'import sans le hook, laissant un import inutilisé et aucun
  // t() disponible.
  if (src.includes("const { t } = useLanguage()")) {
    console.log(`${file} : déjà branché`);
    continue;
  }
  if (!src.startsWith('"use client"')) {
    console.log(`${file} : COMPOSANT SERVEUR — utiliser getTranslations()`);
    continue;
  }

  if (!src.includes('from "@/lib/i18n/language-provider"')) {
    const lastImport = [...src.matchAll(/^import .*;$/gm)].pop();
    if (!lastImport) {
      console.log(`${file} : aucun import trouvé`);
      continue;
    }
    src =
      src.slice(0, lastImport.index + lastImport[0].length) +
      '\nimport { useLanguage } from "@/lib/i18n/language-provider";' +
      src.slice(lastImport.index + lastImport[0].length);
  }

  // Début du corps du composant exporté. Les signatures de ce projet
  // déstructurent les props sur plusieurs lignes et se referment donc par
  // « }) { » en début de ligne, pas par « ) { » — d'où les deux formes.
  const start = src.search(/^export function \w+\(/m);
  if (start === -1) {
    console.log(`${file} : aucun composant exporté`);
    fs.writeFileSync(file, src);
    continue;
  }
  const after = src.slice(start);
  // Trois formes de fermeture de signature dans ce projet :
  //   « }) { »               props déstructurées, type inline
  //   « }: NomDesProps) { »  props déstructurées, type nommé
  //   « ) { »                props simples
  // Le \r? est indispensable : les fichiers de ce dépôt sont en fins de ligne
  // Windows, et un motif qui n'attend que \n ne trouve jamais rien.
  const body = after.match(
    /\r?\n\}(?:\s*:\s*[^)]*)?\)\s*\{\r?\n|\r?\n\)\s*\{\r?\n|^export function \w+\([^)]*\)\s*\{\r?\n/m,
  );
  if (!body) {
    console.log(`${file} : corps du composant introuvable — hook à poser à la main`);
    fs.writeFileSync(file, src);
    continue;
  }
  const at = start + body.index + body[0].length;
  src = src.slice(0, at) + "  const { t } = useLanguage();\n" + src.slice(at);

  fs.writeFileSync(file, src);
  console.log(`${file} : branché`);
}
