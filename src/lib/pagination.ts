/**
 * Numéros de page à afficher : la première, la dernière, la page courante et
 * ses voisines, avec « … » dans les trous. Une école de 600 élèves ne doit
 * pas aligner soixante boutons sous la liste.
 */
export function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const kept = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  kept.forEach((page, i) => {
    if (i > 0 && page - kept[i - 1] > 1) result.push("…");
    result.push(page);
  });
  return result;
}
