import { smoothPath } from "./smooth-path";

/**
 * Petite courbe de tendance à côté d'un chiffre clé, sans axe ni étiquette :
 * elle ne dit que le sens de l'évolution. La valeur exacte reste le chiffre de
 * la tuile, jamais la courbe seule — d'où `aria-hidden`.
 */
export function Sparkline({
  values,
  color,
  className,
}: {
  values: number[];
  color: string;
  className?: string;
}) {
  if (values.length < 2) return null;

  const W = 72;
  const H = 28;
  const PAD = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i: number) => PAD + (i / (values.length - 1)) * (W - PAD * 2);
  // Série plate : la ligne passe au milieu plutôt que collée au bas du cadre.
  const y = (v: number) =>
    max === min ? H / 2 : H - PAD - ((v - min) / (max - min)) * (H - PAD * 2);

  const d = smoothPath(
    values.map((v, i) => [x(i), y(v)]),
    { minY: PAD, maxY: H - PAD },
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
