import {
  BookMarked,
  BookOpen,
  Brain,
  Calculator,
  Cog,
  Dumbbell,
  FileText,
  FlaskConical,
  Globe,
  Landmark,
  Languages,
  Leaf,
  Monitor,
  Music,
  Palette,
  type LucideIcon,
} from "lucide-react";

export interface SubjectStyle {
  icon: LucideIcon;
  /** Fond et bordure d'une carte de cours. */
  card: string;
  /** Pastille de l'icône. */
  badge: string;
  /** Étiquette de texte (liste des examens). */
  chip: string;
}

const TONES = {
  emerald: {
    card: "border-emerald-100 bg-emerald-50/70",
    badge: "bg-emerald-100 text-emerald-600",
    chip: "bg-emerald-50 text-emerald-700",
  },
  green: {
    card: "border-green-100 bg-green-50/70",
    badge: "bg-green-100 text-green-600",
    chip: "bg-green-50 text-green-700",
  },
  lime: {
    card: "border-lime-100 bg-lime-50/70",
    badge: "bg-lime-100 text-lime-700",
    chip: "bg-lime-50 text-lime-700",
  },
  blue: {
    card: "border-blue-100 bg-blue-50/70",
    badge: "bg-blue-100 text-blue-600",
    chip: "bg-blue-50 text-blue-700",
  },
  amber: {
    card: "border-amber-100 bg-amber-50/70",
    badge: "bg-amber-100 text-amber-600",
    chip: "bg-amber-50 text-amber-700",
  },
  teal: {
    card: "border-teal-100 bg-teal-50/70",
    badge: "bg-teal-100 text-teal-600",
    chip: "bg-teal-50 text-teal-700",
  },
  violet: {
    card: "border-violet-100 bg-violet-50/70",
    badge: "bg-violet-100 text-violet-600",
    chip: "bg-violet-50 text-violet-700",
  },
  orange: {
    card: "border-orange-100 bg-orange-50/70",
    badge: "bg-orange-100 text-orange-600",
    chip: "bg-orange-50 text-orange-700",
  },
  pink: {
    card: "border-pink-100 bg-pink-50/70",
    badge: "bg-pink-100 text-pink-600",
    chip: "bg-pink-50 text-pink-700",
  },
  indigo: {
    card: "border-indigo-100 bg-indigo-50/70",
    badge: "bg-indigo-100 text-indigo-600",
    chip: "bg-indigo-50 text-indigo-700",
  },
  rose: {
    card: "border-rose-100 bg-rose-50/70",
    badge: "bg-rose-100 text-rose-600",
    chip: "bg-rose-50 text-rose-700",
  },
  red: {
    card: "border-red-100 bg-red-50/70",
    badge: "bg-red-100 text-red-600",
    chip: "bg-red-50 text-red-700",
  },
  yellow: {
    card: "border-yellow-100 bg-yellow-50/70",
    badge: "bg-yellow-100 text-yellow-700",
    chip: "bg-yellow-50 text-yellow-700",
  },
  slate: {
    card: "border-slate-200 bg-slate-50",
    badge: "bg-slate-100 text-slate-600",
    chip: "bg-slate-100 text-slate-700",
  },
} as const;

type Tone = keyof typeof TONES;

// Mots-clés cherchés dans le nom de la matière, sans accents ni majuscules.
// L'ordre compte : « Éducation physique » doit être reconnue avant
// « Physique-Chimie », qui contient elle aussi « physique ».
const RULES: [RegExp, LucideIcon, Tone][] = [
  [/math/, Calculator, "emerald"],
  [/educ\w* physique|\beps\b|sport/, Dumbbell, "lime"],
  [/physi|chimi/, FlaskConical, "pink"],
  [/franc/, BookOpen, "blue"],
  [/arabe/, Languages, "amber"],
  [/islam|coran|relig/, BookMarked, "teal"],
  [/angl|english/, FileText, "violet"],
  [/hist|geo/, Globe, "orange"],
  [/vie et de la terre|\bsvt\b|naturel|biolog/, Leaf, "green"],
  [/inform/, Monitor, "indigo"],
  [/philo/, Brain, "rose"],
  [/musi/, Music, "red"],
  [/\bart|dessin/, Palette, "rose"],
  [/techno/, Cog, "yellow"],
  [/civi|citoyen/, Landmark, "slate"],
];

function normalize(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Icône et couleurs d'une matière, déduites de son nom : les mêmes sur
 * l'emploi du temps et dans la liste des examens, sans réglage à faire par
 * l'école. Une matière inconnue reçoit un livre sur fond neutre.
 */
export function subjectStyle(name: string): SubjectStyle {
  const key = normalize(name);
  for (const [pattern, icon, tone] of RULES) {
    if (pattern.test(key)) return { icon, ...TONES[tone] };
  }
  return { icon: BookOpen, ...TONES.slate };
}
