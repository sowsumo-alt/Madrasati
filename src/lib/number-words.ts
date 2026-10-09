/**
 * Un montant écrit en toutes lettres, en français, comme sur les reçus :
 * « Arrêté le présent reçu à la somme de vingt mille ouguiyas ». C'est ce
 * qui empêche de transformer « 5 000 » en « 50 000 » d'un trait de stylo.
 *
 * Règles de l'orthographe traditionnelle : « vingt et un », « soixante et
 * onze », « quatre-vingts » mais « quatre-vingt-un », « deux cents » mais
 * « deux cent un », « mille » invariable, « deux millions ».
 */

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "dix-sept", "dix-huit", "dix-neuf",
];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

/** 0 à 99. */
function belowHundred(n: number): string {
  if (n < 20) return UNITS[n];
  if (n < 70) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    if (unit === 0) return TENS[ten];
    return unit === 1 ? `${TENS[ten]} et un` : `${TENS[ten]}-${UNITS[unit]}`;
  }
  if (n < 80) {
    // 70 à 79 : soixante-dix, soixante et onze, soixante-douze…
    return n === 71 ? "soixante et onze" : `soixante-${UNITS[n - 60]}`;
  }
  // 80 à 99 : quatre-vingts, quatre-vingt-un… quatre-vingt-dix-neuf.
  return n === 80 ? "quatre-vingts" : `quatre-vingt-${UNITS[n - 80]}`;
}

/** 0 à 999 ; `final` : le nombre n'est suivi de rien (« deux cents » et non « deux cent »). */
function belowThousand(n: number, final: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds === 1) parts.push("cent");
  else if (hundreds > 1) parts.push(rest === 0 && final ? `${UNITS[hundreds]} cents` : `${UNITS[hundreds]} cent`);
  if (rest > 0 || hundreds === 0) {
    let words = belowHundred(rest);
    // « quatre-vingts » perd son s quand un autre mot suit (quatre-vingt mille).
    if (!final && words === "quatre-vingts") words = "quatre-vingt";
    parts.push(words);
  }
  return parts.join(" ");
}

/** Un entier positif ou nul en lettres : 20000 → « vingt mille ». */
export function numberToFrenchWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return "zéro";
  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (billions > 0) {
    parts.push(`${belowThousand(billions, true)} milliard${billions > 1 ? "s" : ""}`);
  }
  if (millions > 0) {
    parts.push(`${belowThousand(millions, true)} million${millions > 1 ? "s" : ""}`);
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? "mille" : `${belowThousand(thousands, false)} mille`);
  }
  if (rest > 0) parts.push(belowThousand(rest, true));
  return parts.join(" ");
}

const ouguiya = (amount: number) => (Math.floor(Math.abs(amount)) > 1 ? "ouguiyas" : "ouguiya");

/**
 * « vingt mille ouguiyas » — la monnaie mauritanienne, au pluriel dès deux.
 * `amount` est en MRU. Une école qui écrit en MRO lit sur le reçu le montant
 * de sa fiche papier (en anciennes ouguiyas) puis son équivalent en MRU.
 */
export function amountInWords(amount: number, unit: "MRU" | "MRO" = "MRU"): string {
  const mru = `${numberToFrenchWords(amount)} ${ouguiya(amount)}`;
  if (unit !== "MRO") return mru;
  const mro = amount * 10;
  return `${numberToFrenchWords(mro)} anciennes ${ouguiya(mro)} (MRO), soit ${mru} (MRU)`;
}
