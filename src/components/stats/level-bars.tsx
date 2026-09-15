/** Élèves par niveau : une seule teinte, la longueur porte l'effectif et le chiffre est écrit. */
export function LevelBars({
  data,
  emptyLabel,
}: {
  data: { label: string; value: number }[];
  emptyLabel: string;
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-foreground/40">{emptyLabel}</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className="space-y-3.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-3">
          <span className="text-sm font-semibold text-foreground">{d.label}</span>
          <span className="h-3 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
            <span
              className="block h-full rounded-full bg-gradient-to-r from-primary-700 to-emerald-500 rtl:bg-gradient-to-l"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </span>
          <span
            className="text-end text-sm font-semibold text-foreground"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {d.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
