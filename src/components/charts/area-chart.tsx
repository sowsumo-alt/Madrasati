"use client";

import { useId } from "react";
import { SERIE, type Point } from "./chart-primitives";
import { smoothPath } from "./smooth-path";

const GRID = "#e6ebe7";
const INK_MUTED = "#6b7772";

/**
 * Courbe lissée avec aire dégradée — une seule série (le titre de la carte
 * suffit, pas de légende). Graduations fixes en quarts, pratiques pour un
 * pourcentage : 0, 25, 50, 75, 100.
 */
export function AreaChart({
  data,
  unit = "",
  max = 100,
  color = SERIE,
  emptyLabel,
}: {
  data: Point[];
  unit?: string;
  max?: number;
  color?: string;
  emptyLabel: string;
}) {
  const gradientId = useId();

  if (data.length === 0) {
    return <p className="py-16 text-center text-xs text-foreground/40">{emptyLabel}</p>;
  }

  const W = 560;
  const H = 230;
  const PAD = { top: 14, right: 18, bottom: 32, left: 44 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const baseline = PAD.top + plotH;

  const x = (i: number) =>
    PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (Math.min(v, max) / max) * plotH;

  const points = data.map((d, i) => [x(i), y(d.value)] as [number, number]);
  const line = smoothPath(points, { minY: PAD.top, maxY: baseline });
  const area = `${line} L${x(data.length - 1)},${baseline} L${x(0)},${baseline} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={data.map((d) => `${d.label} ${d.value}${unit}`).join(", ")}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
          <text
            x={PAD.left - 10}
            y={y(t) + 4}
            textAnchor="end"
            fontSize={11}
            fill={INK_MUTED}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {t}
            {unit}
          </text>
        </g>
      ))}

      {data.map((d, i) => (
        <line
          key={`v-${d.label}`}
          x1={x(i)}
          x2={x(i)}
          y1={PAD.top}
          y2={baseline}
          stroke={GRID}
          strokeWidth={1}
          strokeDasharray="3 4"
        />
      ))}

      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />

      {data.map((d, i) => (
        <g key={d.label}>
          <circle cx={x(i)} cy={y(d.value)} r={4.5} fill={color} stroke="#ffffff" strokeWidth={2} />
          <title>{`${d.label} : ${d.value}${unit}`}</title>
          <text x={x(i)} y={H - 10} textAnchor="middle" fontSize={12} fill={INK_MUTED}>
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
