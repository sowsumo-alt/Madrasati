import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";

import { generateReceiptNumber } from "../src/lib/receipts";

/**
 * Le numéro de reçu a bloqué la Finance d'une école en production : la
 * numérotation partait du *nombre* de paiements, si bien qu'un seul trou dans
 * la suite (un paiement supprimé, un import) faisait retomber le calcul sur un
 * numéro déjà pris. La contrainte d'unicité rejetait l'écriture, et comme le
 * calcul ne dépendait de rien d'autre, les cinq réessais rejouaient le même
 * numéro : l'école ne pouvait plus jamais encaisser. Ces tests fixent la règle
 * qui remplace le comptage.
 */

/** Client de transaction minimal : seul $queryRaw est utilisé par la fonction. */
function txWithMax(max: number | null): Prisma.TransactionClient {
  return {
    $queryRaw: async () => [{ max }],
  } as unknown as Prisma.TransactionClient;
}

const year = new Date().getFullYear();
const pad = (n: number) => String(n).padStart(4, "0");

test("la première école numérote à partir de 1", async () => {
  assert.equal(await generateReceiptNumber(txWithMax(null), "ecole"), `REC-${year}-0001`);
});

test("le numéro suit le plus grand déjà attribué", async () => {
  assert.equal(await generateReceiptNumber(txWithMax(4), "ecole"), `REC-${year}-0005`);
});

test("un trou dans la suite ne fait pas retomber sur un numéro déjà pris", async () => {
  // Le cas exact du blocage : trois reçus existants (0001, 0003, 0004), donc
  // un comptage aurait proposé 0004 — déjà utilisé. C'est le maximum qui
  // fait foi, pas le nombre de lignes.
  assert.equal(await generateReceiptNumber(txWithMax(4), "ecole"), `REC-${year}-0005`);
});

test("chaque réessai vise le numéro suivant, jamais le même", async () => {
  const tx = txWithMax(4);
  const numbers = [
    await generateReceiptNumber(tx, "ecole", 0),
    await generateReceiptNumber(tx, "ecole", 1),
    await generateReceiptNumber(tx, "ecole", 2),
  ];
  assert.deepEqual(numbers, [`REC-${year}-0005`, `REC-${year}-0006`, `REC-${year}-0007`]);
  assert.equal(new Set(numbers).size, 3, "deux réessais ne doivent jamais produire le même numéro");
});

test("le numéro reste lisible au-delà de 9999", async () => {
  // Le zéro devant ne sert qu'à l'alignement : passé quatre chiffres, le
  // numéro s'allonge au lieu d'être tronqué.
  assert.equal(await generateReceiptNumber(txWithMax(9999), "ecole"), `REC-${year}-10000`);
});

test("le numéro porte toujours l'année civile en cours", async () => {
  const n = await generateReceiptNumber(txWithMax(12), "ecole");
  assert.ok(n.startsWith(`REC-${year}-`), n);
  assert.equal(n, `REC-${year}-${pad(13)}`);
});
