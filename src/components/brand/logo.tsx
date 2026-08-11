/**
 * Marque Madrasati : toque de diplômé posée sur un livre ouvert doré,
 * encadrée de deux branches de laurier. Dessinée en SVG (aucune image à
 * télécharger) pour rester nette à toutes les tailles et sur les connexions
 * lentes.
 */

const LEAVES = [
  { x: 11, y: 27, a: -55 },
  { x: 9.5, y: 34, a: -35 },
  { x: 10, y: 41, a: -15 },
  { x: 12.5, y: 47.5, a: 5 },
  { x: 16.5, y: 52.5, a: 25 },
];

function Branch() {
  return (
    <g>
      <path
        d="M20 55C10 49 6.5 39 8.5 26"
        fill="none"
        stroke="var(--primary-600)"
        strokeWidth={2}
        strokeLinecap="round"
      />
      {LEAVES.map((l) => (
        <ellipse
          key={`${l.x}-${l.y}`}
          cx={l.x}
          cy={l.y}
          rx={4.4}
          ry={2.3}
          fill="var(--primary-500)"
          transform={`rotate(${l.a} ${l.x} ${l.y})`}
        />
      ))}
    </g>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-hidden="true">
      <Branch />
      <g transform="translate(64,0) scale(-1,1)">
        <Branch />
      </g>

      {/* Livre / socle */}
      <rect x={18} y={29.5} width={28} height={3.4} rx={1.2} fill="var(--accent-400)" />
      <rect x={21.4} y={34.5} width={3.8} height={11.5} fill="var(--accent-400)" />
      <rect x={30.1} y={34.5} width={3.8} height={11.5} fill="var(--accent-300)" />
      <rect x={38.8} y={34.5} width={3.8} height={11.5} fill="var(--accent-400)" />
      <rect x={16.5} y={47.4} width={31} height={3.6} rx={1.4} fill="var(--accent-500)" />

      {/* Toque */}
      <path
        d="M21 18.5V26c7.3 4.4 14.7 4.4 22 0v-7.5z"
        fill="var(--primary-700)"
      />
      <path d="M32 4 54 14 32 24 10 14z" fill="var(--primary-800)" />
      <path
        d="M54 14v8"
        stroke="var(--accent-400)"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <circle cx={54} cy={24.5} r={2.4} fill="var(--accent-400)" />
    </svg>
  );
}

/** Logo + nom, tel qu'affiché dans l'en-tête et sur la page de connexion. */
export function LogoWordmark({
  className,
  markClassName = "h-8 w-8",
  textClassName = "text-xl",
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ""}`}>
      <Logo className={markClassName} />
      <span className={`font-bold tracking-tight text-primary-800 ${textClassName}`}>
        Madrasati
      </span>
    </span>
  );
}
