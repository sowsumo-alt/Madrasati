/**
 * Erreur destinée à être lue par le directeur (« La classe 1AF B existe déjà »).
 *
 * En production, Next.js remplace le message de toute erreur levée par une
 * action serveur par un texte technique (« An error occurred in the Server
 * Components render… ») : le directeur ne voyait jamais la vraie raison. Une
 * action attrape donc ses UserError et renvoie leur message comme résultat ;
 * les autres erreurs, qui peuvent contenir des détails internes, restent
 * masquées.
 */
export class UserError extends Error {}

export type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

export async function asResult<T extends object>(run: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, ...(await run()) };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    throw e;
  }
}
