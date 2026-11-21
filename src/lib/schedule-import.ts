/**
 * Import d'un emploi du temps depuis le fichier de l'école (Excel ou Word),
 * tel qu'il est déjà tapé. Trois dispositions sont reconnues :
 *  - une grille, les jours en colonnes et les horaires en lignes ;
 *  - la même grille tournée : les jours en lignes, les horaires en colonnes ;
 *  - une liste, une ligne par cours (Jour | Horaire | Matière | Salle).
 *
 * Chaque case devient un cours ; la matière est reconnue d'après les matières
 * de l'école (« Maths », « PC », « HG », « العربية »…), la salle d'après
 * « Salle 3 ». Deux cases identiques qui se suivent (cellule fusionnée sur
 * deux heures) font un seul cours. Rien n'est enregistré ici : le directeur
 * voit tout, corrige une matière, puis confirme.
 *
 * Sans dépendance au navigateur : testé tel quel (tests/schedule-import.test.ts).
 */
import type { ImportCell } from "./student-import";

export interface ImportSubject {
  id: string;
  name: string;
  nameAr?: string | null;
}

export interface ParsedSlot {
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
  /** La matière telle qu'écrite dans le fichier, sans la salle : c'est elle qu'on fait correspondre. */
  label: string;
  room: string | null;
}

export type ScheduleLayout = "days-in-columns" | "days-in-rows" | "list";

export interface ScheduleParse {
  layout: ScheduleLayout | null;
  slots: ParsedSlot[];
}

// — Texte —

const ARABIC_MARKS = /[ً-ٰٟـ]/g; // voyelles, tatwil
export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // accents français, hamza et voyelles arabes
    .normalize("NFC")
    .replace(ARABIC_MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .replace(/[’'`´.,;:!?()[\]{}"«»_/\\|*+°#–—-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const cellText = (v: ImportCell) => (v instanceof Date ? "" : String(v ?? "").replace(/\s+/g, " ").trim());

// — Jours —

const DAYS: [number, string[], string[]][] = [
  // [jour ISO, noms complets, abréviations seules dans leur case]
  [1, ["lundi", "monday", "الاثنين", "اثنين"], ["lun", "mon", "lu"]],
  [2, ["mardi", "tuesday", "الثلاثاء", "ثلاثاء"], ["mar", "tue", "ma"]],
  [3, ["mercredi", "wednesday", "الاربعاء", "اربعاء"], ["mer", "wed", "me"]],
  [4, ["jeudi", "thursday", "الخميس", "خميس"], ["jeu", "thu", "je"]],
  [5, ["vendredi", "friday", "الجمعه", "جمعه"], ["ven", "fri", "ve"]],
  [6, ["samedi", "saturday", "السبت", "سبت"], ["sam", "sat", "sa"]],
  [7, ["dimanche", "sunday", "الاحد", "احد"], ["dim", "sun", "di"]],
];

/** « Lundi », « LUNDI الاثنين », « Lun. » → 1 ; null si la case n'est pas un jour. */
export function parseDay(value: ImportCell): number | null {
  const text = normalizeText(cellText(value));
  if (!text) return null;
  for (const [day, , short] of DAYS) if (short.includes(text)) return day;
  const found = new Set<number>();
  for (const word of text.split(" ")) {
    for (const [day, full] of DAYS) if (full.includes(word)) found.add(day);
  }
  // Une case qui parle d'un seul jour, et pas d'autre chose qu'un jour (« Lundi 8h » n'en est pas un).
  if (found.size !== 1) return null;
  const rest = text.split(" ").filter((w) => !DAYS.some(([, full]) => full.includes(w)));
  return rest.length === 0 ? [...found][0] : null;
}

// — Horaires —

const TIME = String.raw`(\d{1,2})\s*(?:[hH:.]\s*(\d{2})?)?\s*(am|pm)?`;
const RANGE = new RegExp(String.raw`^\s*(?:de\s+)?${TIME}\s*(?:-|–|—|à|a|au|to|/|>)+\s*${TIME}\s*$`, "i");
const SINGLE = new RegExp(String.raw`^\s*${TIME}\s*$`, "i");

function toMinutes(hours: string, minutes: string | undefined, meridiem: string | undefined): number | null {
  let h = Number(hours);
  const m = minutes ? Number(minutes) : 0;
  if (m > 59) return null;
  if (meridiem?.toLowerCase() === "pm" && h < 12) h += 12;
  // Personne n'a cours à 3 h du matin : « 3h-4h » se lit l'après-midi.
  else if (!meridiem && h >= 1 && h <= 6) h += 12;
  if (h > 23) return null;
  return h * 60 + m;
}

/** « 8h-9h », « 08:00 – 10:00 », « 8h30 à 10h », « 15H-16H » → minutes ; end null pour une heure seule (« 8h »). */
export function parseTimeRange(value: ImportCell): { start: number; end: number | null } | null {
  const text = cellText(value).replace(/\s+/g, " ");
  if (!text) return null;
  const range = RANGE.exec(text);
  if (range) {
    const start = toMinutes(range[1], range[2], range[3]);
    const end = toMinutes(range[4], range[5], range[6]);
    if (start == null || end == null || end <= start || end - start > 6 * 60) return null;
    return { start, end };
  }
  const single = SINGLE.exec(text);
  // Une heure seule doit porter son « h » ou ses minutes : un « 3 » isolé est un numéro, pas une heure.
  if (single && /[hH:]/.test(text)) {
    const start = toMinutes(single[1], single[2], single[3]);
    return start == null ? null : { start, end: null };
  }
  return null;
}

// — Cases —

const BREAKS = new Set(["pause", "recreation", "recre", "break", "repos", "استراحه", "راحه", "x", "libre", "vide"]);

/** Une case de cours : sa matière et sa salle (« Maths Salle 3 », « PC (S12) »). null pour une case vide ou une pause. */
export function parseCourseCell(value: ImportCell): { label: string; room: string | null } | null {
  const raw = cellText(value);
  if (!raw || /^[-–—_.\s/]+$/.test(raw)) return null;
  if (BREAKS.has(normalizeText(raw))) return null;
  let room: string | null = null;
  const roomMatch =
    /\b(?:salle|sal\.?|room)\s*(?:n°|no|n|:|°|-)?\s*([A-Za-z]?\d+[A-Za-z]?|[A-Z])\b/i.exec(raw) ??
    /\(\s*S\s*(\d+)\s*\)|\bS(\d+)\b/.exec(raw) ??
    /(?:قاعة|القاعة)\s*(\d+)/.exec(raw);
  let label = raw;
  if (roomMatch) {
    room = (roomMatch[1] ?? roomMatch[2]).toUpperCase();
    label = (raw.slice(0, roomMatch.index) + raw.slice(roomMatch.index + roomMatch[0].length)).trim();
  }
  label = label.replace(/^[\s,;:/|()–—-]+|[\s,;:/|(–—-]+$/g, "").replace(/\(\s*\)/g, "").trim();
  if (!label) return null;
  return { label, room };
}

// — Matières —

const STOP_WORDS = new Set(["et", "de", "la", "le", "les", "des", "du", "d", "l", "en", "a"]);
const words = (text: string) => text.split(" ").filter(Boolean);
const initials = (text: string) =>
  words(text)
    .filter((w) => !STOP_WORDS.has(w))
    .map((w) => w[0])
    .join("");

/** Abréviations courantes → un mot du nom de la matière. */
const ALIASES: Record<string, string[]> = {
  fr: ["francais"],
  ar: ["arabe"],
  math: ["mathematiques", "math"],
  maths: ["mathematiques", "math"],
  svt: ["naturelles", "vie"],
  sn: ["naturelles"],
  pc: ["physique chimie", "physique"],
  hg: ["histoire"],
  ir: ["religieuse", "islamique"],
  ii: ["islamique", "religieuse"],
  ic: ["civique"],
  ec: ["civique"],
  eps: ["sportive", "sport"],
  ang: ["anglais"],
  info: ["informatique"],
  philo: ["philosophie"],
  coran: ["coran"],
  quran: ["coran"],
};

/** La matière de l'école que désigne une case : la plus sûre, ou null si rien ne correspond (ou si deux se valent). */
export function matchSubject(label: string, subjects: ImportSubject[]): string | null {
  const text = normalizeText(label);
  if (!text) return null;
  const tokens = words(text);
  // « H.G », « P.C » : un sigle écrit avec des points.
  if (tokens.length > 1 && tokens.every((t) => t.length === 1)) tokens.push(tokens.join(""));
  const padded = ` ${text} `;
  let best: { id: string; score: number } | null = null;
  let tie = false;
  for (const subject of subjects) {
    const name = normalizeText(subject.name);
    const ar = normalizeText(subject.nameAr ?? "");
    const arCore = ar.replace(/^ال/, ""); // « رياضيات » pour « الرياضيات »
    let score = 0;
    if (text === name || (ar && text === ar)) score = 100;
    else if (name && padded.includes(` ${name} `)) score = 95;
    else if (ar && text.includes(ar)) score = 94;
    else if (arCore.length >= 3 && text.includes(arCore)) score = 92;
    else if (name && ` ${name} `.startsWith(padded)) score = 90; // « Physique » → « Physique Chimie »
    else if (name && ` ${name} `.includes(padded)) score = 85; // « Physique » → « Éducation Physique » : moins sûr
    else {
      const init = initials(name);
      if (init.length >= 2 && tokens.includes(init)) score = 80;
      for (const token of tokens) {
        const targets = ALIASES[token];
        if (targets?.some((t) => ` ${name} `.includes(` ${t}`))) score = Math.max(score, 78);
        // « Math » → « Mathématiques », « Phys » → « Physique-Chimie », « Ang » → « Anglais ».
        if (token.length >= 3 && words(name).some((w) => w.length > token.length && w.startsWith(token))) {
          score = Math.max(score, 70);
        }
      }
    }
    if (score === 0) continue;
    if (!best || score > best.score) {
      best = { id: subject.id, score };
      tie = false;
    } else if (score === best.score) {
      tie = true;
    }
  }
  return best && !tie ? best.id : null;
}

// — Lecture du tableau —

/** Cellules fusionnées d'une feuille Excel : chaque case de la fusion reçoit la valeur de la première. */
export function fillMerges(
  rows: ImportCell[][],
  merges: { s: { r: number; c: number }; e: { r: number; c: number } }[],
  origin: { r: number; c: number } = { r: 0, c: 0 },
): ImportCell[][] {
  const out = rows.map((r) => [...r]);
  for (const m of merges) {
    const value = out[m.s.r - origin.r]?.[m.s.c - origin.c];
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        const row = (out[r - origin.r] ??= []);
        row[c - origin.c] = value;
      }
    }
  }
  return out;
}

interface Cell {
  day: number;
  start: number;
  end: number | null;
  value: ImportCell;
}

/** Les horaires d'une seule heure (« 8h ») finissent où commence la suivante, sinon une heure plus tard. */
function closeTimes(times: { start: number; end: number | null }[]): { start: number; end: number }[] {
  const starts = [...new Set(times.map((t) => t.start))].sort((a, b) => a - b);
  return times.map((t) => ({
    start: t.start,
    end: t.end ?? starts.find((s) => s > t.start) ?? t.start + 60,
  }));
}

function cellsToSlots(cells: Cell[]): ParsedSlot[] {
  const closed = closeTimes(cells.map((c) => ({ start: c.start, end: c.end })));
  const slots: ParsedSlot[] = [];
  cells.forEach((cell, i) => {
    // Une heure ou un jour n'est pas un cours (une liste lue à tort comme une grille).
    if (parseTimeRange(cell.value) || parseDay(cell.value) != null) return;
    const course = parseCourseCell(cell.value);
    if (!course) return;
    slots.push({ dayOfWeek: cell.day, startMinutes: closed[i].start, endMinutes: closed[i].end, ...course });
  });
  return mergeConsecutive(slots);
}

/** Même matière, même salle, l'une à la suite de l'autre le même jour : un seul cours. */
export function mergeConsecutive(slots: ParsedSlot[]): ParsedSlot[] {
  const sorted = [...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinutes - b.startMinutes);
  const out: ParsedSlot[] = [];
  for (const slot of sorted) {
    const last = out[out.length - 1];
    if (
      last &&
      last.dayOfWeek === slot.dayOfWeek &&
      last.endMinutes === slot.startMinutes &&
      normalizeText(last.label) === normalizeText(slot.label) &&
      last.room === slot.room
    ) {
      last.endMinutes = slot.endMinutes;
    } else if (
      !(last && last.dayOfWeek === slot.dayOfWeek && last.startMinutes === slot.startMinutes && last.endMinutes === slot.endMinutes)
    ) {
      out.push({ ...slot });
    }
  }
  return out;
}

const SCAN = 15; // les en-têtes sont dans les premières lignes

function daysInColumns(rows: ImportCell[][]): ParsedSlot[] {
  for (let h = 0; h < Math.min(rows.length, SCAN); h++) {
    const dayCols = new Map<number, number>();
    (rows[h] ?? []).forEach((v, c) => {
      const day = parseDay(v);
      if (day != null && ![...dayCols.values()].includes(day)) dayCols.set(c, day);
    });
    if (dayCols.size < 2) continue;
    const firstDayCol = Math.min(...dayCols.keys());
    const cells: Cell[] = [];
    for (const row of rows.slice(h + 1)) {
      // L'horaire est dans une des colonnes à gauche des jours.
      let time: { start: number; end: number | null } | null = null;
      for (let c = 0; c < Math.max(firstDayCol, 1) && !time; c++) time = parseTimeRange(row?.[c]);
      if (!time) continue;
      for (const [c, day] of dayCols) cells.push({ day, ...time, value: row?.[c] });
    }
    return cellsToSlots(cells);
  }
  return [];
}

function daysInRows(rows: ImportCell[][]): ParsedSlot[] {
  for (let h = 0; h < Math.min(rows.length, SCAN); h++) {
    const timeCols = new Map<number, { start: number; end: number | null }>();
    (rows[h] ?? []).forEach((v, c) => {
      const time = parseTimeRange(v);
      if (time) timeCols.set(c, time);
    });
    if (timeCols.size < 2) continue;
    const firstTimeCol = Math.min(...timeCols.keys());
    const cells: Cell[] = [];
    const closedList = closeTimes([...timeCols.values()]);
    const closed = new Map([...timeCols.keys()].map((c, i) => [c, closedList[i]]));
    for (const row of rows.slice(h + 1)) {
      let day: number | null = null;
      for (let c = 0; c < Math.max(firstTimeCol, 1) && day == null; c++) day = parseDay(row?.[c]);
      if (day == null) continue;
      for (const [c] of timeCols) cells.push({ day, ...closed.get(c)!, value: row?.[c] });
    }
    return cellsToSlots(cells);
  }
  return [];
}

type ListColumn = "day" | "time" | "start" | "end" | "subject" | "room";

/** La colonne d'une liste d'après son en-tête (« Heure de début » → start, « Matière » → subject). */
function listColumn(header: ImportCell): ListColumn | null {
  const text = normalizeText(cellText(header));
  if (!text) return null;
  const has = (...names: string[]) => names.some((n) => words(text).includes(n) || (n.length > 4 && text.startsWith(n)));
  if (has("jour", "jours", "day", "اليوم", "يوم")) return "day";
  if (has("matiere", "matieres", "discipline", "disciplines", "cours", "subject", "الماده", "ماده", "المواد")) return "subject";
  if (has("salle", "room", "القاعه", "قاعه")) return "room";
  if (has("debut", "start", "من", "البدايه") || text === "de") return "start";
  if (has("fin", "end", "الي", "النهايه") || text === "a") return "end";
  if (has("horaire", "horaires", "heure", "heures", "creneau", "time", "التوقيت", "الوقت", "الساعه")) return "time";
  return null;
}

function list(rows: ImportCell[][]): ParsedSlot[] {
  for (let h = 0; h < Math.min(rows.length, SCAN); h++) {
    const cols: Partial<Record<ListColumn, number>> = {};
    (rows[h] ?? []).forEach((v, c) => {
      const key = listColumn(v);
      if (key && cols[key] == null) cols[key] = c;
    });
    if (cols.day == null || cols.subject == null || (cols.time == null && cols.start == null)) continue;
    const slots: ParsedSlot[] = [];
    for (const row of rows.slice(h + 1)) {
      const day = parseDay(row?.[cols.day]);
      if (day == null) continue;
      let time = cols.time != null ? parseTimeRange(row?.[cols.time]) : null;
      if (!time && cols.start != null) {
        const start = parseTimeRange(row?.[cols.start]);
        const end = cols.end != null ? parseTimeRange(row?.[cols.end]) : null;
        if (start) time = { start: start.start, end: start.end ?? end?.start ?? null };
      }
      if (!time) continue;
      const course = parseCourseCell(row?.[cols.subject]);
      if (!course) continue;
      const room = cols.room != null ? cellText(row?.[cols.room]) || null : null;
      slots.push({
        dayOfWeek: day,
        startMinutes: time.start,
        endMinutes: time.end ?? time.start + 60,
        label: course.label,
        room: room ?? course.room,
      });
    }
    return mergeConsecutive(slots.filter((s) => s.endMinutes > s.startMinutes));
  }
  return [];
}

/** Le tableau du fichier → les cours qu'il décrit, d'après la disposition qui en trouve le plus. */
export function parseScheduleRows(rows: ImportCell[][]): ScheduleParse {
  const candidates: [ScheduleLayout, ParsedSlot[]][] = [
    ["days-in-columns", daysInColumns(rows)],
    ["days-in-rows", daysInRows(rows)],
    ["list", list(rows)],
  ];
  const [layout, slots] = candidates.reduce((a, b) => (b[1].length > a[1].length ? b : a));
  return slots.length > 0 ? { layout, slots } : { layout: null, slots: [] };
}

/** La classe dont le nom figure dans le titre ou le nom de la feuille (« EDT 1AS A » → 1AS A), la plus précise d'abord. */
export function suggestClassId(texts: (string | null | undefined)[], classes: { id: string; name: string }[]): string | null {
  const compact = (s: string) => normalizeText(s).replace(/[\s°]/g, "");
  const haystack = texts.filter(Boolean).map((t) => compact(t!));
  let best: { id: string; length: number } | null = null;
  for (const c of classes) {
    const name = compact(c.name);
    if (!name) continue;
    const found = haystack.some((h) => {
      const at = h.indexOf(name);
      // « 1as » ne doit pas se lire dans « 11as » : le nom commence à un début de mot chiffré.
      return at >= 0 && !(at > 0 && /\d/.test(h[at - 1]) && /^\d/.test(name));
    });
    if (found && (!best || name.length > best.length)) best = { id: c.id, length: name.length };
  }
  return best?.id ?? null;
}

export const DAY_LABELS_FR = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}h${String(minutes % 60).padStart(2, "0")}`;
}
