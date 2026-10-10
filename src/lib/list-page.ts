/**
 * Listes paginées côté serveur : la page demandée dans l'adresse (?page=3),
 * ramenée à la dernière s'il y en a moins. Le serveur n'envoie que ces lignes.
 */

type Param = string | string[] | undefined;

export function pageParam(value: Param): number {
  const n = Number.parseInt((Array.isArray(value) ? value[0] : value) ?? "", 10);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

export function textParam(value: Param, max = 100): string {
  return ((Array.isArray(value) ? value[0] : value) ?? "").slice(0, max);
}

export function pageOf<T>(items: T[], page: number, size: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pageCount);
  return {
    rows: items.slice((current - 1) * size, current * size),
    total: items.length,
    page: current,
    pageCount,
  };
}

/** Adresse d'une liste : recherche et page, sans les valeurs par défaut. */
export function listHref(path: string, params: Record<string, string | number | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "" || (key === "page" && Number(value) <= 1)) continue;
    p.set(key, String(value));
  }
  const qs = p.toString();
  return qs ? `${path}?${qs}` : path;
}
