import { findStandardLevel } from "@/lib/class-catalog";
import { isValidNni, normalizeNni } from "@/lib/nni";

/**
 * Lecture d'une liste d'élèves venue d'un fichier Excel d'école, tel que les
 * écoles mauritaniennes les tiennent déjà : un titre (« JARDIN ») au-dessus
 * du tableau, des colonnes « N° », « Prénoms et Nom », « Lieu et date de
 * naissance », « NNI », « Tél »…, et des totaux en bas (« Effectif »,
 * « Nombre de Garçons »). Le directeur importe son fichier tel quel, sans le
 * recopier dans un modèle.
 *
 * Sans dépendance à la base ni à React, pour être testé à part.
 */

export const IMPORT_FIELDS = [
  "ignore",
  "number",
  "fullName",
  "firstName",
  "lastName",
  "birthPlaceDate",
  "dateOfBirth",
  "placeOfBirth",
  "gender",
  "nni",
  "rimNumber",
  "nationality",
  "phone",
  "className",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  ignore: "Ignorer cette colonne",
  number: "N° d'ordre",
  fullName: "Prénom et nom (ensemble)",
  firstName: "Prénom",
  lastName: "Nom de famille",
  birthPlaceDate: "Lieu et date de naissance",
  dateOfBirth: "Date de naissance",
  placeOfBirth: "Lieu de naissance",
  gender: "Genre",
  nni: "NNI",
  rimNumber: "N° RIM",
  nationality: "Nationalité",
  phone: "Téléphone du parent",
  className: "Classe",
};

/** « Prénoms et Nom » → « prenoms et nom » : casse, accents et ponctuation ignorés. */
export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[°º]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Mots de l'en-tête reconnus pour chaque champ, du plus précis au plus vague. */
const HEADER_RULES: [ImportField, RegExp][] = [
  ["fullName", /\b(prenoms? (et|&)? ?noms?|noms? (et|&)? ?prenoms?|nom complet|noms? de l eleve|eleves?)\b/],
  ["birthPlaceDate", /\b(lieu (et|&)? ?date|date (et|&)? ?lieu)\b/],
  ["dateOfBirth", /\b(date( de)? naiss\w*|ne le|nee le|date n|ddn)\b/],
  ["placeOfBirth", /\b(lieu( de)? naiss\w*|ne a|nee a|lieu)\b/],
  ["firstName", /^(prenoms?|first ?name)$/],
  ["lastName", /^(nom|noms|nom de famille|last ?name)$/],
  ["nni", /\b(nni|n n i|numero national|identifiant national)\b/],
  ["gender", /\b(genre|sexe|sex|gender|g f)\b/],
  ["phone", /\b(tel|tele|telephone|phone|portable|contact|numero du parent|n tel)\b/],
  ["rimNumber", /\b(rim|n rim|numero rim)\b/],
  ["nationality", /\b(nationalite|nation)\b/],
  ["className", /^(classe|class|niveau)$/],
  ["number", /^(n|no|num|numero|n ordre|matricule|ordre|nr)$/],
];

/**
 * Champ Madrasati suggéré pour une colonne, d'après son en-tête puis, si
 * l'en-tête ne dit rien, d'après ses valeurs (10 chiffres : un NNI ; « RIM » :
 * la nationalité ; « M »/« F » : le genre).
 */
export function suggestField(header: unknown, samples: unknown[] = []): ImportField {
  const h = normalizeHeader(header);
  if (h) {
    for (const [field, rule] of HEADER_RULES) if (rule.test(h)) return field;
  }
  const values = samples.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (values.length === 0) return "ignore";
  const share = (test: (v: string) => boolean) => values.filter(test).length / values.length;
  if (share((v) => isValidNni(v)) >= 0.6) return "nni";
  if (share((v) => /^(rim|mauritani\w*)$/i.test(v)) >= 0.6) return "nationality";
  if (share((v) => parseGender(v) !== null) >= 0.8) return "gender";
  if (share((v) => v.replace(/\D/g, "").length >= 8 && /^[+\d\s.-]+$/.test(v)) >= 0.6) return "phone";
  if (share((v) => /^\d{1,3}$/.test(v)) >= 0.8) return "number";
  return "ignore";
}

/** « M », « G », « Garçon », « Masculin », « ذكر » → M ; l'équivalent → F. */
export function parseGender(value: unknown): "M" | "F" | null {
  const v = normalizeHeader(value);
  if (/^(m|g|h|masculin|garcon|homme|male|boy)$/.test(v) || String(value ?? "").trim() === "ذكر") return "M";
  if (/^(f|feminin|fille|femme|female|girl)$/.test(v) || String(value ?? "").trim() === "أنثى") return "F";
  return null;
}

const PARTICLES = new Set(["ould", "mint", "ben", "bint", "ebnou", "ibn", "wuld"]);

/**
 * Sépare « Prénoms et Nom » : le nom de famille commence à la particule
 * mauritanienne (« Mohamed Lemine Ould Sidi » → Mohamed Lemine / Ould Sidi) ;
 * sans particule, le dernier mot est le nom (« Aminata Moussa Diallo » →
 * Aminata Moussa / Diallo). Le directeur corrige avant l'import au besoin.
 */
export function splitImportedName(full: string): { firstName: string; lastName: string } {
  const words = full.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { firstName: "", lastName: "" };
  if (words.length === 1) return { firstName: words[0], lastName: "" };
  const particle = words.findIndex((w, i) => i > 0 && PARTICLES.has(w.toLowerCase()));
  const cut = particle > 0 && particle < words.length - 1 ? particle : words.length - 1;
  return { firstName: words.slice(0, cut).join(" "), lastName: words.slice(cut).join(" ") };
}

/**
 * Date de naissance lue d'une cellule : date Excel, « 12/03/2019 »,
 * « 2019-03-12 », ou numéro de série Excel. Renvoie « AAAA-MM-JJ ».
 */
export function parseBirthDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return isoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  const fr = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(text);
  if (fr) return isoDate(Number(fr[3]), Number(fr[2]), Number(fr[1]));
  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(text)) * 86_400_000);
    return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  if (/^(19|20)\d{2}$/.test(text)) return null; // une année seule ne fait pas une date
  return null;
}

/** Une date qui existe vraiment : « 31/02/2012 » n'en est pas une (elle deviendrait le 2 mars). */
function isoDate(year: number, month: number, day: number): string | null {
  if (year < 1950 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Une date écrite dans la cellule (« 31/02/2012 »), lisible ou non. */
const DATE_TEXT = /\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{4}-\d{1,2}-\d{1,2}/;

/** « Nouakchott le 12/03/2019 », « 12/03/2019 à Kiffa » → lieu et date. */
export function splitBirthPlaceDate(value: unknown): { place: string | null; date: string | null } {
  if (value instanceof Date) return { place: null, date: parseBirthDate(value) };
  const text = String(value ?? "").trim();
  const date = parseBirthDate(text);
  const place = text
    .replace(/\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{4}-\d{1,2}-\d{1,2}|\b(19|20)\d{2}\b/g, " ")
    // Mots de liaison retirés, accentués compris (« à », « née ») : \b ne
    // reconnaît pas les lettres accentuées, d'où les espaces explicites.
    .replace(/(^|\s)(le|la|a|à|en|vers|né|née|ne|nee)(?=\s|$)/giu, " ")
    .replace(/[,;/()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { place: place || null, date };
}

/**
 * Cellule de récapitulatif : « Effectif », « Total », « Nombre de Garçons »,
 * ou « Filles : 18 ». Une cellule « Fille » de la colonne Genre n'en est pas une.
 */
function isSummaryCell(value: unknown): boolean {
  const v = normalizeHeader(value);
  return (
    // « Effectif », « Effective », « Nombres de Filles: 10 », « Nbre garçons »…
    /^(effecti\w*|totale?s?|nombres?|nbres?|nb|sous totale?s?|recapitulatif)\b/.test(v) ||
    /^(garcons?|filles?|eleves?)\b.*\d/.test(v)
  );
}

export type ImportCell = string | number | boolean | Date | null | undefined;

/**
 * Ligne d'en-tête du tableau : la première ligne où au moins deux cellules
 * sont reconnues comme des en-têtes connus. -1 si le fichier n'en a pas.
 */
export function findHeaderRow(rows: ImportCell[][]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const known = rows[i].filter((cell) => {
      const h = normalizeHeader(cell);
      return h && HEADER_RULES.some(([, rule]) => rule.test(h));
    }).length;
    if (known >= 2) return i;
  }
  return -1;
}

/**
 * Titre écrit au-dessus du tableau (« JARDIN ») : la dernière ligne d'une
 * seule cellule avant l'en-tête. C'est souvent le nom de la classe.
 */
export function findTitle(rows: ImportCell[][], headerRow: number): string | null {
  for (let i = headerRow - 1; i >= 0; i--) {
    const cells = rows[i].map((c) => String(c ?? "").trim()).filter(Boolean);
    if (cells.length === 1 && cells[0].length <= 40) return cells[0];
  }
  return null;
}

export interface ImportedStudent {
  /** Ligne du fichier, comptée comme dans Excel (1 = première ligne). */
  row: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  gender: "M" | "F" | null;
  nni: string | null;
  rimNumber: string | null;
  nationality: string | null;
  phone: string | null;
  className: string | null;
  /** Remarques qui n'empêchent pas l'import (NNI illisible…). */
  warnings: string[];
}

export interface ImportPreview {
  students: ImportedStudent[];
  /** Lignes volontairement laissées de côté : vides, totaux. */
  ignored: { row: number; reason: string; text: string }[];
  /** Lignes qui ressemblent à un élève mais ne peuvent pas être importées. */
  errors: { row: number; reason: string; text: string }[];
}

/**
 * Élèves d'un fichier, selon la correspondance de colonnes choisie. Les
 * lignes vides et les totaux (« Effectif 40 », « Nombre de Filles ») sont
 * ignorés ; une ligne sans nom est signalée en erreur plutôt qu'importée.
 */
export function buildImportPreview(
  rows: ImportCell[][],
  headerRow: number,
  mapping: ImportField[],
): ImportPreview {
  const preview: ImportPreview = { students: [], ignored: [], errors: [] };
  const col = (field: ImportField) => mapping.indexOf(field);
  const cell = (r: ImportCell[], field: ImportField) => {
    const i = col(field);
    return i === -1 ? undefined : r[i];
  };
  const text = (value: ImportCell) =>
    value instanceof Date ? value.toLocaleDateString("fr-FR") : String(value ?? "").trim();
  const seenNni = new Map<string, number>();

  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const row = i + 1;
    const line = r.map(text).filter(Boolean).join(" · ");
    if (!line) {
      continue; // ligne vide : ni élève ni information
    }
    if (r.some(isSummaryCell)) {
      preview.ignored.push({ row, reason: "Ligne de total", text: line });
      continue;
    }

    let firstName = text(cell(r, "firstName"));
    let lastName = text(cell(r, "lastName"));
    const full = text(cell(r, "fullName"));
    if (full && !firstName && !lastName) ({ firstName, lastName } = splitImportedName(full));
    else if (full && !lastName) lastName = splitImportedName(full).lastName;

    if (!firstName && !lastName) {
      // Un numéro seul (liste prénumérotée de 1 à 40) n'est pas un élève ;
      // une ligne remplie mais sans nom en est peut-être un, à signaler.
      const numberCol = col("number");
      const otherData = r.some((v, idx) => idx !== numberCol && text(v));
      if (otherData) preview.errors.push({ row, reason: "Nom manquant", text: line });
      else preview.ignored.push({ row, reason: "Ligne sans élève", text: line });
      continue;
    }
    const warnings: string[] = [];
    if (!firstName || !lastName) {
      // Un seul nom (« Sidi ») : l'élève est importé, nom de famille à compléter.
      firstName = firstName || lastName;
      lastName = "";
      warnings.push("Un seul nom : nom de famille à compléter sur la fiche");
    }
    // Un nom avec des chiffres (« Total 40 ») n'est pas un élève : on le
    // montre au directeur plutôt que de l'inscrire.
    if (/\d/.test(`${firstName} ${lastName}`)) {
      preview.errors.push({ row, reason: "Nom avec des chiffres (ligne de total ?)", text: line });
      continue;
    }
    // Une formule Excel (« =HYPERLINK(…) ») n'est pas un nom : signalée, jamais importée.
    if (/^[=+\-@]/.test(firstName) || /^[=+\-@]/.test(lastName)) {
      preview.errors.push({ row, reason: "Formule Excel à la place du nom", text: line });
      continue;
    }

    let dateOfBirth = parseBirthDate(cell(r, "dateOfBirth"));
    let placeOfBirth = text(cell(r, "placeOfBirth")) || null;
    const both = cell(r, "birthPlaceDate");
    if (both != null && text(both)) {
      const split = splitBirthPlaceDate(both);
      dateOfBirth = dateOfBirth ?? split.date;
      placeOfBirth = placeOfBirth ?? split.place;
    }
    if (col("dateOfBirth") !== -1 && text(cell(r, "dateOfBirth")) && !dateOfBirth) {
      warnings.push("Date de naissance illisible");
    } else if (!dateOfBirth && both != null && DATE_TEXT.test(text(both))) {
      warnings.push("Date de naissance impossible (ex. 31/02), laissée vide");
    }

    const rawNni = text(cell(r, "nni"));
    let nni: string | null = null;
    if (rawNni) {
      if (isValidNni(rawNni)) {
        nni = normalizeNni(rawNni);
        const first = seenNni.get(nni);
        if (first != null) {
          preview.errors.push({ row, reason: `NNI déjà présent ligne ${first}`, text: line });
          continue;
        }
        seenNni.set(nni, row);
      } else {
        warnings.push("NNI incomplet, laissé vide");
      }
    }

    const nationalityRaw = text(cell(r, "nationality"));
    const nationality = /^rim$/i.test(nationalityRaw) ? "Mauritanienne" : nationalityRaw || null;
    const phoneDigits = text(cell(r, "phone")).replace(/\D/g, "");

    preview.students.push({
      row,
      firstName,
      lastName,
      dateOfBirth,
      placeOfBirth,
      gender: parseGender(cell(r, "gender")),
      nni,
      rimNumber: text(cell(r, "rimNumber")) || null,
      nationality,
      phone: phoneDigits.length >= 8 ? phoneDigits : null,
      className: text(cell(r, "className")) || null,
      warnings,
    });
  }
  return preview;
}

/**
 * Classe proposée pour tout le fichier, d'après son titre : un niveau du
 * catalogue (« JARDIN » → Préscolaire / Jardin), sinon le titre tel quel.
 */
export function suggestClassFromTitle(
  title: string | null,
): { category: string; level: string; section: string } | null {
  if (!title) return null;
  const whole = findStandardLevel(title);
  if (whole) return { ...whole, section: "" };
  // « Liste des élèves 1AF B », « CLASSE : 5SN » : un niveau connu au milieu
  // du titre, et la lettre qui le suit éventuellement comme section.
  const words = title.trim().split(/[\s:–-]+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    for (const size of [2, 1]) {
      const found = findStandardLevel(words.slice(i, i + size).join(" "));
      if (found) {
        const next = words[i + size];
        const section = next && /^[A-Z0-9]$/i.test(next) ? next.toUpperCase() : "";
        return { ...found, section };
      }
    }
  }
  return { category: "", level: title.trim(), section: "" };
}
