import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Préfixe des numéros de reçu d'une année civile, ex: « REC-2026- ». */
function receiptPrefix(year: number) {
  return `REC-${year}-`;
}

/**
 * Numéro de reçu séquentiel par école et par année, ex: REC-2026-0001.
 *
 * Le numéro est déduit du **plus grand numéro déjà attribué**, et non du
 * nombre de paiements enregistrés. La différence n'est pas cosmétique : avec
 * un simple `count() + 1`, il suffisait qu'un paiement soit supprimé — ou que
 * la numérotation présente le moindre trou — pour que le compte cesse de
 * correspondre au dernier numéro. Le numéro calculé entrait alors en collision
 * avec un reçu existant, la contrainte d'unicité (schoolId, receiptNumber)
 * rejetait l'écriture, et comme le calcul était purement déterministe, tous
 * les réessais reproduisaient le même numéro. L'école ne pouvait plus jamais
 * encaisser un paiement, ni inscrire un élève avec des frais d'inscription :
 * « Une erreur est survenue », définitivement.
 *
 * `attempt` décale le numéro à chaque nouvel essai. C'est ce qui donne enfin
 * un sens à la boucle de réessai : sous forte concurrence, deux paiements
 * simultanés lisent le même maximum, l'un des deux perd la course, et son
 * essai suivant vise le numéro d'après au lieu de rejouer indéfiniment celui
 * qui vient d'être pris.
 *
 * À appeler depuis une transaction (le client `tx`) : lire le maximum ne
 * verrouille rien à lui seul, c'est `runWithReceipt` qui gère le réessai.
 */
export async function generateReceiptNumber(
  tx: Prisma.TransactionClient,
  schoolId: string,
  attempt = 0,
) {
  const year = new Date().getFullYear();
  const prefix = receiptPrefix(year);

  // Le maximum est calculé en base, sur la partie numérique du numéro
  // (« REC-2026-0007 » -> 7, troisième segment). Un tri alphabétique ne
  // suffirait pas : passé REC-2026-9999, « REC-2026-10000 » se classerait
  // avant « REC-2026-9999 ». Le filtre par expression régulière écarte tout
  // numéro d'une autre forme, qui ferait échouer la conversion en entier.
  const rows = await tx.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST(split_part("receiptNumber", '-', 3) AS INTEGER)) AS max
    FROM payments
    WHERE "schoolId" = ${schoolId}
      AND "receiptNumber" ~ ${`^${prefix}[0-9]+$`}
  `;

  const lastNumber = rows[0]?.max ?? 0;
  const next = lastNumber + 1 + attempt;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

const MAX_RECEIPT_ATTEMPTS = 5;

/**
 * Exécute une transaction qui attribue un numéro de reçu, en la rejouant si
 * le numéro a été pris entre-temps.
 *
 * Les trois écrans qui encaissent — Finance, inscription d'un élève avec
 * frais, réinscription — passent par ici. Auparavant, seul Finance retentait ;
 * les deux autres abandonnaient au premier conflit, et l'inscription entière
 * était perdue avec le paiement. Une règle de numérotation partagée mérite un
 * traitement d'erreur partagé.
 *
 * L'isolation Serializable est celle qui empêche deux paiements simultanés de
 * lire tous les deux « 0 déjà payé » et de conclure chacun que le frais reste
 * partiel. Un échec de sérialisation (P2034) est retenté au même titre qu'une
 * collision de numéro (P2002) ; la transaction ayant été annulée en entier, le
 * rejeu repart d'un état propre.
 */
export async function runWithReceipt<T>(
  fn: (tx: Prisma.TransactionClient, attempt: number) => Promise<T>,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RECEIPT_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction((tx) => fn(tx, attempt), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 20_000,
      });
    } catch (e) {
      lastError = e;
      const retryable =
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === "P2002" || e.code === "P2034");
      if (!retryable) throw e;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("L'enregistrement du paiement a échoué, réessayez.");
}
