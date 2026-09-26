import { formatPhone } from "@/lib/format";

/**
 * En-tête des documents imprimés par une école : bulletins, reçus, bulletins
 * de salaire.
 *
 * Deux parties, qui ne viennent pas du même endroit :
 * - le bloc officiel de l'État (République, devise, ministère), identique
 *   pour toutes les écoles et modifiable par le seul Super Admin ;
 * - l'identité de l'école (nom, logo, adresse, ville, téléphone), saisie une
 *   fois par le directeur dans ses Paramètres et reprise partout.
 */

export interface OfficialHeaderText {
  linesFr: string[];
  linesAr: string[];
}

/** Texte en vigueur tant que le Super Admin n'a rien changé. */
export const DEFAULT_OFFICIAL_HEADER: OfficialHeaderText = {
  linesFr: [
    "République Islamique de Mauritanie",
    "Honneur — Fraternité — Justice",
    "Ministère de l'Éducation Nationale",
    "Direction de l'Enseignement Fondamental et Secondaire",
  ],
  linesAr: [
    "الجمهورية الإسلامية الموريتانية",
    "شرف - إخاء - عدالة",
    "وزارة التهذيب الوطني",
    "مديرية التعليم الأساسي والثانوي",
  ],
};

export const OFFICIAL_HEADER_MAX_LINES = 6;

/**
 * Lignes saisies dans un champ de texte : une par ligne, sans les lignes
 * vides ni les espaces en trop.
 */
export function splitHeaderLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export interface SchoolIdentity {
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  logoUrl: string | null;
  /**
   * Le logo est un en-tête complet (nom, adresse, téléphone déjà dans
   * l'image) : il s'imprime seul, en pleine largeur.
   */
  logoIsLetterhead: boolean;
}

/** Ce qu'il faut lire de School pour composer l'en-tête. */
export const SCHOOL_IDENTITY_SELECT = {
  name: true,
  address: true,
  city: true,
  phone: true,
  logoUrl: true,
  logoIsLetterhead: true,
} as const;

export function toSchoolIdentity(
  school: {
    name: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    logoUrl: string | null;
    logoIsLetterhead?: boolean;
  } | null,
): SchoolIdentity {
  const clean = (value: string | null | undefined) => value?.trim() || null;
  return {
    name: clean(school?.name) ?? "Madrasati",
    address: clean(school?.address),
    city: clean(school?.city),
    phone: clean(school?.phone),
    logoUrl: school?.logoUrl || null,
    // Sans image, l'option n'a pas de sens : on retombe sur l'en-tête texte.
    logoIsLetterhead: Boolean(school?.logoUrl && school.logoIsLetterhead),
  };
}

/**
 * « Tevragh Zeina, Nouakchott » : l'adresse puis la ville, sans répéter la
 * ville quand le directeur l'a déjà écrite dans l'adresse. Null quand
 * l'école n'a rien renseigné — l'en-tête omet alors la ligne.
 */
export function schoolPlaceLine(school: SchoolIdentity): string | null {
  const parts = [school.address, school.city].filter((p): p is string => Boolean(p));
  if (parts.length === 2 && parts[0].toLowerCase().includes(parts[1].toLowerCase())) {
    parts.pop();
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

export function schoolPhoneLine(school: SchoolIdentity): string | null {
  return school.phone ? formatPhone(school.phone) : null;
}
