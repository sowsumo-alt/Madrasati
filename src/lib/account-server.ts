import { randomInt } from "node:crypto";

/**
 * Mot de passe temporaire lisible à voix haute et facile à recopier sur un
 * téléphone : le directeur le transmet au parent ou à l'enseignant par
 * WhatsApp. On évite donc les caractères ambigus (0/O, 1/l/I) et la casse
 * mélangée.
 *
 * Isolé de src/lib/account.ts (plutôt que d'y rester) car "node:crypto" ne
 * peut pas être empaqueté pour le navigateur : dès qu'un composant client
 * importe quoi que ce soit de ce fichier, Next.js échoue à la compilation.
 * Ce module ne doit donc être importé que depuis du code serveur (server
 * actions, Route Handlers) — jamais depuis un composant "use client".
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ";
const DIGITS = "23456789";

export function generateTempPassword() {
  // randomInt (CSPRNG) plutôt que Math.random() : ce mot de passe protège un
  // compte réel tant qu'il n'a pas été changé à la première connexion.
  const letters = Array.from(
    { length: 4 },
    () => ALPHABET[randomInt(ALPHABET.length)],
  ).join("");
  const digits = Array.from(
    { length: 4 },
    () => DIGITS[randomInt(DIGITS.length)],
  ).join("");
  return `${letters}-${digits}`;
}
