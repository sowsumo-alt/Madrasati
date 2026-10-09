import { Prisma } from "@prisma/client";
import { prepareWriteGuard, prisma } from "@/lib/prisma";
import { UserError } from "@/lib/user-error";

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
  //
  // Les parts d'un paiement familial (« REC-2026-0012-1 », « -2 »…) comptent
  // aussi : elles portent le numéro du reçu familial, qui ne doit jamais être
  // redonné à un paiement ordinaire. Le reçu familial lui-même vit dans une
  // autre table, mais ses parts sont toujours ici, dans la même transaction.
  //
  // Les paiements annulés comptent aussi : un reçu « ANNULÉ » garde son
  // numéro, qui ne doit jamais désigner un autre encaissement.
  const pattern = `^${prefix}[0-9]+(-[0-9]+)?$`;
  const rows = await tx.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST(split_part(n, '-', 3) AS INTEGER)) AS max
    FROM (
      SELECT "receiptNumber" AS n FROM payments WHERE "schoolId" = ${schoolId}
      UNION ALL
      SELECT "receiptNumber" AS n FROM cancelled_payments WHERE "schoolId" = ${schoolId}
    ) AS numbers
    WHERE n ~ ${pattern}
  `;

  const lastNumber = rows[0]?.max ?? 0;
  const next = lastNumber + 1 + attempt;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

/** Numéro de la part n° `rank` (à partir de 1) d'un paiement familial :
 *  « REC-2026-0012 » -> « REC-2026-0012-2 ». */
export function familyPartReceiptNumber(familyReceiptNumber: string, rank: number) {
  return `${familyReceiptNumber}-${rank}`;
}

const MAX_RECEIPT_ATTEMPTS = 5;

/** Clé d'envoi fournie par le formulaire : lettres, chiffres et tirets seulement. */
function submissionKeyOf(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (!/^[A-Za-z0-9-]{8,64}$/.test(value)) throw new UserError("Envoi invalide : rechargez la page et recommencez.");
  return value;
}

/** Relit un résultat enregistré, dates comprises. */
function parseResult<T>(json: string): T {
  return JSON.parse(json, (_k, v) =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) ? new Date(v) : v,
  ) as T;
}

/** Verrou des encaissements d'une école, tenu jusqu'à la fin de la transaction. */
export async function lockSchoolReceipts(tx: Prisma.TransactionClient, schoolId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"receipts:" + schoolId}, 0))`;
}

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
 * Les encaissements d'une même école passent un par un : chaque transaction
 * commence par prendre un verrou propre à l'école (pg_advisory_xact_lock),
 * relâché à sa fin. En « Read Committed », la transaction qui attendait relit
 * ensuite l'état validé par la précédente : le numéro suivant est toujours
 * le bon (aucun trou, aucune collision) et deux paiements du même frais ne
 * peuvent plus lire tous les deux « 0 déjà payé ». Auparavant, en
 * « Serializable » sans verrou, deux encaissements simultanés entraient en
 * conflit : l'un était rejoué avec un numéro décalé (un trou dans la suite des
 * reçus) ou finissait en erreur après plusieurs rejeux.
 *
 * Le rejeu sur P2002 / P2034 reste un filet de sécurité.
 */
export async function runWithReceipt<T>(
  schoolId: string,
  fn: (tx: Prisma.TransactionClient, attempt: number) => Promise<T>,
  options: { submissionKey?: string | null } = {},
): Promise<T> {
  const key = submissionKeyOf(options.submissionKey);
  let lastError: unknown;
  // Hors de la transaction : aucune connexion supplémentaire ne sera demandée
  // pendant l'attente du verrou (voir primeWriteGuard).
  await prepareWriteGuard();

  for (let attempt = 0; attempt < MAX_RECEIPT_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await lockSchoolReceipts(tx, schoolId);
        // Même envoi déjà traité (double clic, réseau qui relance) : on rend le
        // résultat du premier, rien n'est encaissé une seconde fois. Le verrou
        // de l'école fait attendre le second envoi jusqu'à la fin du premier.
        if (key) {
          const done = await tx.submissionKey.findUnique({ where: { schoolId_key: { schoolId, key } } });
          if (done) return parseResult<T>(done.result);
        }
        const result = await fn(tx, attempt);
        if (key) await tx.submissionKey.create({ data: { schoolId, key, result: JSON.stringify(result ?? null) } });
        return result;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        // Une inscription de famille (plusieurs enfants, plusieurs mois) fait
        // plus de requêtes qu'un paiement, et un encaissement peut attendre son
        // tour derrière un autre de la même école : de la marge sur une
        // connexion lente, pour attendre plutôt qu'échouer.
        timeout: 60_000,
        maxWait: 20_000,
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
