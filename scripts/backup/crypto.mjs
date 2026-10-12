// Chiffrement des sauvegardes de la base (voir docs/sauvegardes.md).
//
// Chaque sauvegarde est chiffrée avec une clé AES-256-GCM tirée au hasard ;
// cette clé est elle-même chiffrée avec la clé PUBLIQUE de l'école Madrasati
// (RSA-OAEP, SHA-256). Seule la clé PRIVÉE, gardée hors de GitHub par le
// responsable, permet de relire une sauvegarde : GitHub et ses artefacts ne
// voient jamais qu'un fichier illisible.
//
// Format : « MADRASATI-SAUVEGARDE-1\n », longueur de la clé chiffrée (4 octets),
// clé chiffrée, vecteur d'initialisation (12), étiquette GCM (16), données.
import {
  constants,
  createCipheriv,
  createDecipheriv,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from "node:crypto";

const MAGIC = Buffer.from("MADRASATI-SAUVEGARDE-1\n");
const OAEP = { padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" };

/** Paire de clés RSA 4096 bits, au format PEM. */
export function generateBackupKeys() {
  return generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

export function encryptBackup(data, publicKeyPem) {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(data), cipher.final()]);
  const wrapped = publicEncrypt({ key: publicKeyPem, ...OAEP }, key);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(wrapped.length);
  return Buffer.concat([MAGIC, length, wrapped, iv, cipher.getAuthTag(), body]);
}

export function decryptBackup(blob, privateKeyPem) {
  if (!blob.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Ce fichier n'est pas une sauvegarde Madrasati.");
  let at = MAGIC.length;
  const length = blob.readUInt32BE(at);
  at += 4;
  const key = privateDecrypt({ key: privateKeyPem, ...OAEP }, blob.subarray(at, at + length));
  at += length;
  const iv = blob.subarray(at, at + 12);
  const tag = blob.subarray(at + 12, at + 28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  // Un seul octet modifié fait échouer final() : une sauvegarde abîmée ne se relit jamais à moitié.
  return Buffer.concat([decipher.update(blob.subarray(at + 28)), decipher.final()]);
}
