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
  "CHEQUE",
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
  CHEQUE: "Chèque",
  MASRVI: "Mobile Money Masrvi",
  SEDAD: "Mobile Money Sedad",
  BAKILY: "Mobile Money Bakily",
};

/**
 * Logo de la marque, pour les modes de paiement qui en sont une.
 *
 * Espèces et virement bancaire n'y figurent pas : ce ne sont pas des marques,
 * seulement des façons de payer. Les fichiers attendus sont décrits dans
 * public/paiement/README.md.
 *
 * Un fichier absent n'est pas une erreur : l'écran retombe alors sur le seul
 * libellé (voir le composant PaymentMethodLogo). Les logos peuvent donc être
 * ajoutés un par un, sans que rien ne casse entre-temps.
 */
export const PAYMENT_METHOD_LOGOS: Partial<Record<PaymentMethod, string>> = {
  MASRVI: "/paiement/masrvi.png",
  SEDAD: "/paiement/sedad.png",
  BAKILY: "/paiement/bakily.png",
};
