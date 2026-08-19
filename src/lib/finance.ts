/**
 * Règle de calcul du « reste dû » de l'école, partagée par le tableau de bord,
 * la page Finance et les relances WhatsApp.
 *
 * Elle existe parce que le tableau de bord additionnait le montant *facturé*
 * des frais non soldés, sans retrancher ce qui avait déjà été encaissé : un
 * frais de 15 000 MRU réglé à hauteur de 10 000 comptait pour 15 000, alors
 * que la page Finance et le message envoyé au parent annonçaient 5 000. Trois
 * écrans donnaient trois chiffres différents pour la même question.
 */
export interface OutstandingFee {
  id: string;
  amount: number;
}

/**
 * Reste réellement dû, paiements partiels déduits.
 *
 * `fees` ne doit contenir que les frais non soldés ; `paidByFee` donne le
 * total déjà encaissé par frais. Un frais sur-payé ne vient jamais en
 * déduction des autres : sa contribution est bornée à zéro.
 */
export function outstandingTotal(
  fees: OutstandingFee[],
  paidByFee: Map<string, number>,
): number {
  return fees.reduce(
    (sum, fee) => sum + Math.max(0, fee.amount - (paidByFee.get(fee.id) ?? 0)),
    0,
  );
}
