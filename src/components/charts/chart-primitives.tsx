"use client";

/**
 * Graphiques en SVG pur — aucune librairie externe.
 * Motivation : les écoles mauritaniennes ont souvent une connexion lente ;
 * une librairie de graphiques pèserait plus lourd que toute l'application.
 *
 * Palette validée (script dataviz, surface blanche) :
 *   vert #0f7049 ↔ or #bd8d2c — ΔE 15.4 sous daltonisme, 24.0 en vision normale.
 * L'or passe sous 3:1 de contraste : partout où il porte du sens, une étiquette
 * visible l'accompagne (règle du relief).
 */

export const SERIE = "#0f7049";
export const SERIE_2 = "#bd8d2c";
const GRID = "#dfe4e0";
const INK_MUTED = "#6b7772";

/** Formate un nombre en style français : 12 500 */
function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

/** Arrondit la borne haute à un nombre « propre » pour les graduations. */
function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

// ---------------------------------------------------------------------------

export interface Point {
  label: string;
  value: number;
}

/** Courbe d'évolution — une seule série, donc pas de légende (le titre suffit). */
export function LineChart({
  data,
  unit = "",
  maxOverride,
}: {
  data: Point[];
  unit?: string;
  maxOverride?: number;
}) {
  if (data.length === 0) return <EmptyPlot />;

  const W = 520;
  const H = 200;
  const PAD = { top: 16, right: 40, bottom: 28, left: 44 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = maxOverride ?? niceMax(Math.max(...data.map((d) => d.value), 1));
  const x = (i: number) =>
    PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

  const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.value)}`).join(" ");
  const areaPath = `${path} L${x(data.length - 1)},${PAD.top + plotH} L${x(0)},${
    PAD.top + plotH
  } Z`;

  const ticks = [0, max / 2, max];
  const last = data[data.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Évolution : ${data.map((d) => `${d.label} ${fmt(d.value)}${unit}`).join(", ")}`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(t)}
            y2={y(t)}
            stroke={GRID}
            strokeWidth={1}
          />
          <text
            x={PAD.left - 8}
            y={y(t) + 4}
            textAnchor="end"
            fontSize={11}
            fill={INK_MUTED}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {fmt(t)}
          </text>
        </g>
      ))}

      <path d={areaPath} fill={SERIE} opacity={0.1} />
      <path
        d={path}
        fill="none"
        stroke={SERIE}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {data.map((d, i) => (
        <g key={d.label}>
          {/* Anneau blanc de 2px : le point reste lisible s'il croise la courbe. */}
          <circle cx={x(i)} cy={y(d.value)} r={4} fill={SERIE} stroke="#ffffff" strokeWidth={2} />
          <title>{`${d.label} : ${fmt(d.value)}${unit}`}</title>
          <text
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={11}
            fill={INK_MUTED}
          >
            {d.label}
          </text>
        </g>
      ))}

      {/* Étiquette directe sur le dernier point uniquement. */}
      <text
        x={x(data.length - 1) + 8}
        y={y(last.value) + 4}
        fontSize={12}
        fontWeight={600}
        fill="#1a2420"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {fmt(last.value)}
        {unit}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------

/** Colonnes verticales — une seule série. */
export function ColumnChart({ data, unit = "" }: { data: Point[]; unit?: string }) {
  if (data.length === 0) return <EmptyPlot />;

  const W = 520;
  const H = 200;
  const PAD = { top: 20, right: 12, bottom: 28, left: 56 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = niceMax(Math.max(...data.map((d) => d.value), 1));
  const band = plotW / data.length;
  const barW = Math.min(24, band - 8);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={data.map((d) => `${d.label} ${fmt(d.value)}${unit}`).join(", ")}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(t)}
            y2={y(t)}
            stroke={GRID}
            strokeWidth={1}
          />
          <text
            x={PAD.left - 8}
            y={y(t) + 4}
            textAnchor="end"
            fontSize={11}
            fill={INK_MUTED}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {fmt(t)}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const cx = PAD.left + band * i + band / 2;
        const barH = Math.max(0, (d.value / max) * plotH);
        return (
          <g key={d.label}>
            {/* Coin haut arrondi (4px), pied carré sur la ligne de base. */}
            <path
              d={roundedTopRect(cx - barW / 2, y(d.value), barW, barH, 4)}
              fill={SERIE}
            />
            <title>{`${d.label} : ${fmt(d.value)}${unit}`}</title>
            <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill={INK_MUTED}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Rectangle à sommet arrondi, base carrée — la barre naît de la ligne de base. */
function roundedTopRect(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return "";
  const radius = Math.min(r, h, w / 2);
  return `M${x},${y + h} L${x},${y + radius} Q${x},${y} ${x + radius},${y} L${
    x + w - radius
  },${y} Q${x + w},${y} ${x + w},${y + radius} L${x + w},${y + h} Z`;
}

// ---------------------------------------------------------------------------

/** Barres horizontales — pratique pour des libellés longs (matières, niveaux). */
export function BarList({
  data,
  unit = "",
  maxOverride,
}: {
  data: Point[];
  unit?: string;
  maxOverride?: number;
}) {
  if (data.length === 0) return <EmptyPlot />;

  const max = maxOverride ?? niceMax(Math.max(...data.map((d) => d.value), 1));

  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
          <span className="truncate text-xs text-foreground/70" title={d.label}>
            {d.label}
          </span>
          <div className="h-3 overflow-hidden rounded-sm bg-surface-muted">
            <div
              className="h-full rounded-r-sm"
              style={{
                width: `${Math.max(0, Math.min(100, (d.value / max) * 100))}%`,
                background: SERIE,
              }}
            />
          </div>
          <span
            className="text-xs font-medium text-foreground"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {fmt(d.value)}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Barre empilée unique — deux catégories (ex : filles / garçons). */
export function SplitBar({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return <EmptyPlot />;

  return (
    <div className="space-y-3">
      {/* Le gap de 2px (surface) sépare les segments — pas de bordure. */}
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-sm">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.label}
              style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
              title={`${s.label} : ${fmt(s.value)}`}
            />
          ))}
      </div>
      {/* Légende + étiquettes visibles : l'or passe sous 3:1, la valeur le compense. */}
      <div className="flex flex-wrap gap-4">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-foreground/70">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: s.color }}
            />
            {s.label}
            <span className="font-medium text-foreground">
              {fmt(s.value)} ({Math.round((s.value / total) * 100)}%)
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EmptyPlot() {
  return (
    <p className="py-10 text-center text-xs text-foreground/40">
      Pas encore de données à afficher.
    </p>
  );
}
