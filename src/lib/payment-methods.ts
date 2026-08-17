/**
 * Modes de paiement acceptés — les moyens réellement utilisés par les parents
 * en Mauritanie.
 *
 * Source unique : cette liste était auparavant recopiée dans le module
 * Finance, le formulaire élève et la réinscription, si bien que « Bakily »,
 * ajouté à un seul endroit, manquait dans les deux autres. Tout écran qui
 * propose un mode de paiement doit partir d'ici.
 */
export const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "MASRVI",
  "SEDAD",
  "BAKILY",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

/**
 * Libellés français. Les écrans traduits passent plutôt par les clés
 * `finance.method.<CODE>` du dictionnaire (src/lib/i18n/dictionaries.ts) —
 * les deux listes doivent rester alignées sur PAYMENT_METHODS.
 */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  BANK_TRANSFER: "Virement bancaire",
  MASRVI: "Mobile Money Masrvi",
  SEDAD: "Mobile Money Sedad",
  BAKILY: "Mobile Money Bakily",
};
