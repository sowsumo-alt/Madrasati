/** Construit un lien wa.me : ouvre WhatsApp (mobile) ou WhatsApp Web (ordinateur) avec un message pré-rempli. */
export function buildWhatsAppUrl(phone: string, message: string) {
  const digitsOnly = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(message)}`;
}

export function buildTelUrl(phone: string) {
  return `tel:${phone.replace(/\s/g, "")}`;
}

export function fillTemplate(
  template: string,
  values: Record<string, string>,
) {
  return tidySpacing(template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? ""));
}

/** Variables `{nom}` présentes dans un modèle, sans doublon et dans l'ordre. */
export function extractVariables(template: string): string[] {
  const found = template.match(/\{(\w+)\}/g) ?? [];
  return [...new Set(found.map((v) => v.slice(1, -1)))];
}

/**
 * Nettoie les traces laissées par une variable vide : « de {amount} MRU »
 * devenait « de  MRU » avec un double espace, et une ligne réduite à un seul
 * placeholder laissait une ligne blanche. Sans ce nettoyage, un message
 * incomplet reste visuellement anormal même après correction du fond.
 */
function tidySpacing(text: string) {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/g, ""))
    .join("\n");
}

/**
 * Remplit un modèle en signalant les variables qu'on n'a pas pu renseigner.
 *
 * Un message parti avec « frais de scolarité de  MRU » est pire que pas de
 * message du tout : l'appelant doit pouvoir bloquer l'envoi plutôt que de
 * laisser un montant vide arriver chez un parent.
 *
 * `date` et `schoolName` sont toujours calculables ; les variables réellement
 * à risque sont celles qui dépendent du destinataire ou de ses données
 * (amount, studentName, average, reason…).
 */
export function fillTemplateChecked(
  template: string,
  values: Record<string, string>,
): { text: string; missing: string[] } {
  const missing = extractVariables(template).filter(
    (name) => !values[name] || values[name].trim() === "",
  );
  return { text: fillTemplate(template, values), missing };
}

/** Libellés lisibles des variables, pour expliquer au directeur ce qui manque. */
export const VARIABLE_LABELS: Record<string, string> = {
  parentName: "nom du parent",
  teacherName: "nom de l'enseignant",
  studentName: "nom de l'élève",
  schoolName: "nom de l'école",
  amount: "montant dû",
  date: "date",
  average: "moyenne générale",
  reason: "motif de l'alerte",
};

export function describeVariable(name: string) {
  return VARIABLE_LABELS[name] ?? name;
}

/**
 * Ajoute la traduction arabe à la suite du message, séparée par une ligne de
 * tirets — pour les parents qui ne lisent pas le français.
 */
export function withArabic(body: string, bodyAr?: string | null) {
  const ar = bodyAr?.trim();
  if (!ar) return body;
  return `${body}\n————————\n${ar}`;
}

/**
 * Ligne de signature française : « École {nom} ». Si le nom de l'école
 * commence déjà par « École » (ex. « École Al Amal »), on ne le répète pas —
 * sinon le message affiche « École École Al Amal ».
 */
export function schoolSignatureFr(schoolName: string) {
  const trimmed = schoolName.trim();
  return /^(é|e)cole\b/i.test(trimmed) ? trimmed : `École ${trimmed}`;
}

/** Équivalent arabe de {@link schoolSignatureFr} : « مدرسة {nom} ». */
export function schoolSignatureAr(schoolName: string) {
  const trimmed = schoolName.trim();
  return trimmed.startsWith("مدرسة") ? trimmed : `مدرسة ${trimmed}`;
}
