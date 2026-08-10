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
