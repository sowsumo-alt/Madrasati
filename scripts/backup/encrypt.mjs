// Chiffre une sauvegarde : node scripts/backup/encrypt.mjs <copie> <clé publique> <fichier chiffré>
import { readFileSync, writeFileSync } from "node:fs";
import { encryptBackup } from "./crypto.mjs";

const [input, publicKey, output] = process.argv.slice(2);
if (!input || !publicKey || !output) {
  console.error("Usage : node scripts/backup/encrypt.mjs <copie> <clé publique> <fichier chiffré>");
  process.exit(1);
}
writeFileSync(output, encryptBackup(readFileSync(input), readFileSync(publicKey, "utf8")));
console.log(`Sauvegarde chiffrée : ${output}`);
