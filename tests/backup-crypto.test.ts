import { test } from "node:test";
import assert from "node:assert/strict";

import { decryptBackup, encryptBackup, generateBackupKeys } from "../scripts/backup/crypto.mjs";

const keys = generateBackupKeys();
const copy = Buffer.from("PGDMP… copie fictive de la base : élèves, paiements, notes");

test("une sauvegarde chiffrée se relit à l'identique avec la clé privée", () => {
  const blob = encryptBackup(copy, keys.publicKey);
  assert.ok(!blob.includes(Buffer.from("élèves")), "le contenu est lisible dans le fichier chiffré");
  assert.deepEqual(decryptBackup(blob, keys.privateKey), copy);
});

test("une autre clé, ou un fichier abîmé, ne donne jamais rien", () => {
  const blob = encryptBackup(copy, keys.publicKey);
  const other = generateBackupKeys();
  assert.throws(() => decryptBackup(blob, other.privateKey));
  const damaged = Buffer.from(blob);
  damaged[damaged.length - 1] ^= 1;
  assert.throws(() => decryptBackup(damaged, keys.privateKey));
  assert.throws(() => decryptBackup(Buffer.from("autre chose"), keys.privateKey), /pas une sauvegarde Madrasati/);
});
