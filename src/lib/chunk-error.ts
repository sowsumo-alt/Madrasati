/**
 * Erreurs de chargement d'un fichier JavaScript de l'application.
 *
 * Elles surviennent surtout juste après une mise en ligne : une page ouverte
 * avant la mise à jour réclame des fichiers de l'ancienne version, que le
 * serveur ne fournit plus. Sans rien pour la rattraper, l'erreur laissait le
 * directeur devant l'écran blanc « Application error », alors qu'il suffit de
 * recharger la page pour que le navigateur récupère la nouvelle version.
 */
const CHUNK_ERROR =
  /ChunkLoadError|Loading (CSS )?chunk \S+ failed|Failed to load chunk|dynamically imported module|Importing a module script failed/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return CHUNK_ERROR.test(`${error.name} ${error.message}`);
}

const RELOAD_KEY = "madrasati:chunk-reload-at";

/**
 * Délai pendant lequel on ne recharge pas une seconde fois : si le premier
 * rechargement n'a pas suffi, l'erreur a une autre cause, et recharger en
 * boucle rendrait l'application inutilisable.
 */
const RELOAD_COOLDOWN_MS = 30_000;

/**
 * Recharge la page, une seule fois, après une erreur de chargement.
 *
 * Renvoie `false` sans recharger si un rechargement vient d'avoir lieu, ou si
 * le stockage du navigateur est indisponible (navigation privée stricte) :
 * l'écran d'erreur reste alors affiché, avec son bouton pour recharger.
 */
export function reloadOnceAfterChunkError(now = Date.now()): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (now - last < RELOAD_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
