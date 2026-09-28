import { formatAmount, formatLongDate, formatLongDateAr } from "@/lib/format";
import {
  extractVariables,
  fillTemplate,
  schoolSignatureAr,
  schoolSignatureFr,
  withArabic,
} from "@/lib/whatsapp";

/**
 * Un message envoyé à plusieurs parents : chacun reçoit le sien, avec son
 * nom, ses enfants, ce qu'il doit et sa date d'échéance — en français et en
 * arabe. Le texte affiché à l'écran est celui du premier destinataire ; s'il
 * est retouché, les valeurs de ce parent redeviennent des variables, pour
 * que la retouche profite à tous sans leur envoyer son nom à lui.
 *
 * Sans dépendance à React : testé à part (tests/message-personalize.test.ts).
 */

export interface PersonalChild {
  name: string;
  /** Reste dû aujourd'hui, en MRU (0 : à jour). */
  outstanding: number;
  /** Échéance non réglée la plus ancienne, ISO ; null si à jour. */
  oldestDue: string | null;
}

export interface PersonalRecipient {
  name: string;
  kind: "PARENT" | "TEACHER";
  children: PersonalChild[];
}

/** Variables que Madrasati remplit seul, pour chaque destinataire. */
export const AUTO_VARIABLES = ["parentName", "teacherName", "studentName", "amount", "date", "schoolName"];

export type Lang = "fr" | "ar";

/** « Aminata », « Aminata et Ousmane », « A, B et C » ; en arabe « A و B ». */
export function joinNames(names: string[], lang: Lang): string {
  if (names.length <= 1) return names[0] ?? "";
  const and = lang === "ar" ? " و " : " et ";
  return `${names.slice(0, -1).join(", ")}${and}${names[names.length - 1]}`;
}

/** Valeurs des variables pour un destinataire, dans une langue. */
export function recipientValues(
  recipient: PersonalRecipient,
  lang: Lang,
  context: { today: Date; schoolName: string },
): Record<string, string> {
  const owing = recipient.children.filter((c) => c.outstanding > 0);
  // Un rappel de paiement ne nomme que les enfants concernés.
  const named = owing.length > 0 ? owing : recipient.children;
  const total = owing.reduce((sum, c) => sum + c.outstanding, 0);
  const oldest = owing
    .map((c) => c.oldestDue)
    .filter((d): d is string => Boolean(d))
    .sort()[0];
  const date = oldest ? new Date(oldest) : context.today;
  return {
    parentName: recipient.name,
    teacherName: recipient.name,
    studentName: joinNames(
      named.map((c) => c.name),
      lang,
    ),
    amount: total > 0 ? formatAmount(total) : "",
    date: lang === "ar" ? formatLongDateAr(date) : formatLongDate(date),
    schoolName: lang === "ar" ? schoolSignatureAr(context.schoolName) : schoolSignatureFr(context.schoolName),
  };
}

export interface MessageSource {
  fr: string;
  ar: string | null;
}

/**
 * Le message d'un destinataire. Les valeurs saisies à la main ne remplissent
 * que les variables que Madrasati ne connaît pas (motif, heure…) : un montant
 * tapé pour un parent ne part jamais chez les autres.
 */
export function personalize(
  source: MessageSource,
  recipient: PersonalRecipient,
  context: { today: Date; schoolName: string },
  manual: Record<string, string> = {},
): { text: string; missingAuto: string[]; missingManual: string[] } {
  const extra: Record<string, string> = {};
  for (const [key, value] of Object.entries(manual)) {
    if (!AUTO_VARIABLES.includes(key) && value.trim()) extra[key] = value.trim();
  }
  const fill = (template: string, lang: Lang) => {
    const values = { ...recipientValues(recipient, lang, context), ...extra };
    const missing = extractVariables(template).filter((v) => !values[v]?.trim());
    return { text: fillTemplate(template, values), missing };
  };
  const fr = fill(source.fr, "fr");
  const ar = source.ar ? fill(source.ar, "ar") : null;
  const missing = [...new Set([...fr.missing, ...(ar?.missing ?? [])])];
  return {
    text: withArabic(fr.text, ar?.text),
    missingAuto: missing.filter((v) => AUTO_VARIABLES.includes(v)),
    missingManual: missing.filter((v) => !AUTO_VARIABLES.includes(v)),
  };
}

/** Variables du message que le directeur doit renseigner lui-même. */
export function manualVariables(source: MessageSource): string[] {
  return [...new Set([...extractVariables(source.fr), ...extractVariables(source.ar ?? "")])].filter(
    (v) => !AUTO_VARIABLES.includes(v),
  );
}

const SEPARATOR = "\n————————\n";

function toVariables(text: string, values: Record<string, string>): string {
  // Les plus longues d'abord : « Aminata et Ousmane » avant « Aminata ».
  const pairs = Object.entries(values)
    .filter(([, value]) => value.trim().length >= 2)
    .sort((a, b) => b[1].length - a[1].length);
  let result = text;
  for (const [key, value] of pairs) result = result.split(value).join(`{${key}}`);
  return result;
}

/**
 * Le texte retouché par le directeur, redevenu modèle : les valeurs du
 * premier destinataire (son nom, ses enfants, son montant, sa date)
 * redeviennent des variables, dans chaque langue.
 */
export function sourceFromEdited(
  edited: string,
  recipient: PersonalRecipient,
  context: { today: Date; schoolName: string },
): MessageSource {
  const [frPart, ...rest] = edited.split(SEPARATOR);
  const arPart = rest.length > 0 ? rest.join(SEPARATOR) : null;
  const withoutParent = (values: Record<string, string>) => {
    // Le même nom sert de parent et d'enseignant : une seule variable selon le cas.
    const { teacherName, parentName, ...others } = values;
    return recipient.kind === "TEACHER" ? { ...others, teacherName } : { ...others, parentName };
  };
  return {
    fr: toVariables(frPart, withoutParent(recipientValues(recipient, "fr", context))),
    ar: arPart == null ? null : toVariables(arPart, withoutParent(recipientValues(recipient, "ar", context))),
  };
}
