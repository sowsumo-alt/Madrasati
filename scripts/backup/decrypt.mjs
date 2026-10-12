// Déchiffre une sauvegarde : node scripts/backup/decrypt.mjs <fichier chiffré> <clé privée> <copie>
// La copie obtenue se recharge avec pg_restore (voir docs/sauvegardes.md).
import { readFileSync, writeFileSync } from "node:fs";
import { decryptBackup } from "./crypto.mjs";

const [input, privateKey, output] = process.argv.slice(2);
if (!input || !privateKey || !output) {
  console.error("Usage : node scripts/backup/decrypt.mjs <fichier chiffré> <clé privée> <copie>");
  process.exit(1);
}
const data = decryptBackup(readFileSync(input), readFileSync(privateKey, "utf8"));
writeFileSync(output, data);
console.log(`Copie déchiffrée : ${output} (${Math.round(data.length / 1024)} Ko)`);
