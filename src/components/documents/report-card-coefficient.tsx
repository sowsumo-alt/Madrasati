/**
 * Coefficient d'une matière sur un bulletin. Une matière encore sans moyenne
 * ne compte ni dans la moyenne générale ni dans le total des coefficients
 * (voir generalAverage) : son coefficient s'imprime alors entre parenthèses,
 * pour que la colonne tombe juste avec son total.
 */
export function ReportCardCoefficient({ value, counted }: { value: number; counted: boolean }) {
  if (counted) return <>{value}</>;
  return (
    <span style={{ opacity: 0.55 }} title="Matière sans note : coefficient non compté" data-not-counted>
      {`(${value})`}
    </span>
  );
}

/** Une ligne au moins dont le coefficient n'est pas compté. */
export function hasUncountedCoefficient(rows: { average: number | null; coefficient: number }[]): boolean {
  return rows.some((r) => r.average == null && r.coefficient > 0);
}

export const UNCOUNTED_COEFFICIENT_NOTE =
  "( ) : matière sans note, son coefficient n'entre ni dans le total ni dans la moyenne.";
