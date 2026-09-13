/**
 * Chemin SVG lissé qui passe exactement par chaque point (spline de
 * Catmull-Rom convertie en courbes de Bézier).
 *
 * `minY` / `maxY` bornent les points de contrôle : sans cela, une courbe de
 * présence qui monte à 100 % pouvait déborder au-dessus du cadre du graphique
 * entre deux points, et laisser croire à un taux supérieur à 100 %.
 */
export function smoothPath(
  points: [number, number][],
  bounds?: { minY: number; maxY: number },
): string {
  if (points.length === 0) return "";
  const r = (n: number) => Math.round(n * 100) / 100;
  const clampY = (y: number) =>
    bounds ? Math.min(bounds.maxY, Math.max(bounds.minY, y)) : y;

  let d = `M${r(points[0][0])},${r(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = clampY(p1[1] + (p2[1] - p0[1]) / 6);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = clampY(p2[1] - (p3[1] - p1[1]) / 6);
    d += ` C${r(c1x)},${r(c1y)} ${r(c2x)},${r(c2y)} ${r(p2[0])},${r(p2[1])}`;
  }
  return d;
}
