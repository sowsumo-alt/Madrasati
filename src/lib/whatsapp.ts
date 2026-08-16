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
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
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
