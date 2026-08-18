import fs from "node:fs";

/**
 * Remplace un texte visible par un appel au dictionnaire, en tolérant les
 * espaces et retours à la ligne : le JSX formaté par Prettier coupe les
 * phrases n'importe où, une recherche littérale les rate.
 */

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");

function replaceAll(file, entries) {
  let src = fs.readFileSync(file, "utf8");
  const missed = [];
  let done = 0;

  for (const [text, key] of entries) {
    const body = escape(text);
    const call = `{t("${key}")}`;

    // 1. Texte seul entre deux balises.
    const between = new RegExp(`>\\s*${body}\\s*<`);
    // 2. Texte sur sa propre ligne (libellé après une icône).
    const ownLine = new RegExp(`(\\n[ \\t]*)${body}(\\s*\\n)`);
    // 3. Attribut visible.
    const attr = new RegExp(`((?:title|placeholder|aria-label|label)=)"${body}"`);

    if (between.test(src)) src = src.replace(between, `>${call}<`);
    else if (ownLine.test(src)) src = src.replace(ownLine, `$1${call}$2`);
    else if (attr.test(src)) src = src.replace(attr, `$1{t("${key}")}`);
    else {
      missed.push(text.slice(0, 55));
      continue;
    }
    done++;
  }

  fs.writeFileSync(file, src);
  console.log(`${file} : ${done}/${entries.length}`);
  for (const m of missed) console.log(`   NON TROUVE: ${JSON.stringify(m)}`);
}

const [file, jsonPath] = process.argv.slice(2);
replaceAll(file, JSON.parse(fs.readFileSync(jsonPath, "utf8")));
