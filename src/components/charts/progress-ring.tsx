/**
 * Anneau de progression pour un pourcentage (présence du jour). Le chiffre est
 * écrit au centre : la longueur de l'arc seule ne suffit pas à le lire.
 */
export function ProgressRing({
  value,
  color,
  size = 56,
}: {
  value: number;
  color: string;
  size?: number;
}) {
  const R = 22;
  const STROKE = 5;
  const C = 2 * Math.PI * R;
  const percent = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <svg
      viewBox="0 0 56 56"
      width={size}
      height={size}
      role="img"
      aria-label={`${percent}%`}
    >
      <circle cx={28} cy={28} r={R} fill="none" stroke="#e8ece9" strokeWidth={STROKE} />
      <circle
        cx={28}
        cy={28}
        r={R}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={`${Math.round((percent / 100) * C * 100) / 100} ${C}`}
        transform="rotate(-90 28 28)"
      />
      <text
        x={28}
        y={31.5}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="#1a2420"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {percent}%
      </text>
    </svg>
  );
}
