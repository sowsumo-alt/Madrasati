import { basePrisma } from "@/lib/prisma";

/**
 * Limite d'essais (connexion, inscription publique), partagée par toutes les
 * instances du serveur : le compteur vit en base (table rate_limits), pas en
 * mémoire — sur Vercel, chaque requête peut tomber sur une instance différente.
 *
 * Fenêtre fixe : le compteur repart de zéro quand la fenêtre est passée.
 * Écrit hors de la garde « lecture seule » (basePrisma) : ce n'est pas une
 * donnée d'école, et une connexion n'est jamais une action d'un compte.
 */
export interface Limit {
  /** Nombre d'essais permis dans la fenêtre. */
  max: number;
  /** Durée de la fenêtre, en secondes. */
  windowSeconds: number;
}

/** 5 mots de passe faux en 15 minutes pour un même e-mail. */
export const LOGIN_PER_ACCOUNT: Limit = { max: 5, windowSeconds: 15 * 60 };
/** 50 mots de passe faux en 15 minutes depuis une même adresse (une école entière derrière un même accès). */
export const LOGIN_PER_ADDRESS: Limit = { max: 50, windowSeconds: 15 * 60 };
/** 3 écoles créées par heure depuis une même adresse. */
export const SIGNUP_PER_ADDRESS: Limit = { max: 3, windowSeconds: 60 * 60 };

/** Vrai quand la limite est atteinte pour cette clé (sans compter un essai). */
export async function isLimited(key: string, limit: Limit): Promise<boolean> {
  const rows = await basePrisma.$queryRaw<{ count: number }[]>`
    SELECT "count" FROM rate_limits
    WHERE "key" = ${key} AND "windowStart" > now() - make_interval(secs => ${limit.windowSeconds})
  `;
  return (rows[0]?.count ?? 0) >= limit.max;
}

/** Compte un essai (atomique) ; renvoie le nombre d'essais dans la fenêtre. */
export async function recordAttempt(key: string, limit: Limit): Promise<number> {
  const rows = await basePrisma.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits ("key", "count", "windowStart") VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN rate_limits."windowStart" <= now() - make_interval(secs => ${limit.windowSeconds}) THEN 1 ELSE rate_limits."count" + 1 END,
      "windowStart" = CASE WHEN rate_limits."windowStart" <= now() - make_interval(secs => ${limit.windowSeconds}) THEN now() ELSE rate_limits."windowStart" END
    RETURNING "count"
  `;
  return rows[0]?.count ?? 1;
}

/** Efface le compteur (connexion réussie). */
export async function clearAttempts(key: string): Promise<void> {
  await basePrisma.$executeRaw`DELETE FROM rate_limits WHERE "key" = ${key}`;
}

/** Adresse du client : première adresse de x-forwarded-for (posée par Vercel). */
export function clientAddress(forwardedFor: string | string[] | null | undefined): string {
  const raw = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  return raw?.split(",")[0]?.trim() || "inconnue";
}
