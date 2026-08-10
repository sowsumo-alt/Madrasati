const mruFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

/** Formate un montant entier en Ouguiya mauritaine, ex: 15 000 MRU */
export function formatMRU(amount: number) {
  return `${mruFormatter.format(amount)} MRU`;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatDate(date: Date | string) {
  return dateFormatter.format(new Date(date));
}
