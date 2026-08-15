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
 * Ajoute la traduction arabe à la suite du message — pour les parents qui ne
 * lisent pas le français. Même format que le message bilingue déjà utilisé
 * pour les notes (grades-dialog.tsx) : les deux paragraphes se suivent,
 * séparés par une ligne vide.
 */
export function withArabic(body: string, bodyAr?: string | null) {
  const ar = bodyAr?.trim();
  if (!ar) return body;
  return `${body}\n\n${ar}`;
}
