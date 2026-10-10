import { GoogleGenAI } from "@google/genai";
import type { ReportCard } from "@/lib/report-card-data";
import { MENTION_LABELS_FR } from "@/lib/report-card";

/** Modèle par défaut : rapide, largement suffisant pour un paragraphe, et couvert
 *  par l'offre gratuite de Google AI Studio. Surchargeable via GEMINI_MODEL. */
const DEFAULT_MODEL = "gemini-3.6-flash";

/** L'IA est optionnelle : sans clé configurée, l'application fonctionne normalement. */
export function isAiEnabled() {
  return Boolean(process.env.GEMINI_API_KEY);
}

const SYSTEM_PROMPT = `Tu rédiges l'appréciation trimestrielle d'un bulletin scolaire pour une école privée mauritanienne, à la troisième personne, à destination des parents.

Écris UNE SEULE phrase, courte (25 mots maximum). Retiens l'essentiel : le niveau général, et soit la matière la plus forte, soit celle à travailler. Termine si possible par un conseil bref.

Reste factuel et bienveillant : pas de flatterie, pas de jugement sur l'élève lui-même, pas de promesse sur ses résultats futurs. N'invente aucune donnée absente du relevé.
L'élève est désigné par un code anonyme : n'écris jamais ce code, dis « l'élève » (en arabe : « التلميذ »).

Fournis ensuite la traduction fidèle de cette même phrase en arabe littéraire.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    fr: { type: "string", description: "L'appréciation, une seule phrase en français." },
    ar: { type: "string", description: "La même phrase traduite en arabe littéraire." },
  },
  required: ["fr", "ar"],
} as const;

/**
 * Code anonyme de l'élève dans le texte envoyé à Google : ni son nom, ni son
 * prénom, ni son identifiant ne quittent Madrasati (données de mineurs).
 */
export const AI_STUDENT_CODE = "ELV001";

/** Le relevé envoyé à l'IA : notes, moyennes, rang et assiduité, sous un code anonyme. */
export function aiPrompt(card: ReportCard) {
  const lines = card.results.map((r) => {
    const own = r.average != null ? r.average.toFixed(2) : "aucune note";
    const cls = r.classAverage != null ? r.classAverage.toFixed(2) : "—";
    return `- ${r.subjectName} (coefficient ${r.coefficient}) : ${own}/20 ; moyenne de la classe ${cls}/20`;
  });

  return [
    `Élève : ${AI_STUDENT_CODE}`,
    `Classe : ${card.className}`,
    `Période : ${card.term}`,
    `Moyenne générale pondérée : ${card.average != null ? `${card.average.toFixed(2)}/20` : "non calculable"}`,
    `Mention : ${MENTION_LABELS_FR[card.mention]}`,
    card.rank != null ? `Rang : ${card.rank} sur ${card.classSize}` : "Rang : non calculable",
    `Assiduité : ${card.attendance.absent} absence(s), ${card.attendance.late} retard(s)`,
    "",
    "Résultats par matière :",
    ...lines,
  ].join("\n");
}

export interface Appreciation {
  fr: string;
  ar: string;
}

export async function generateAppreciation(card: ReportCard): Promise<Appreciation> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Aucune clé API configurée.");

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    contents: aiPrompt(card),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const raw = response.text?.trim();
  if (!raw) {
    throw new Error(
      "Le service n'a rien renvoyé. Réessayez, ou rédigez l'appréciation à la main.",
    );
  }

  let parsed: Partial<Appreciation>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Réponse illisible. Réessayez.");
  }

  const fr = cleanAppreciation(parsed.fr?.trim() ?? "", "fr");
  if (!fr) throw new Error("Réponse incomplète. Réessayez.");

  return { fr, ar: cleanAppreciation(parsed.ar?.trim() ?? "", "ar") };
}

/** Si le code anonyme revient malgré la consigne, il devient « l'élève » (« التلميذ »). */
export function cleanAppreciation(text: string, lang: "fr" | "ar"): string {
  if (!text.includes(AI_STUDENT_CODE)) return text;
  if (lang === "ar") return text.split(AI_STUDENT_CODE).join("التلميذ");
  return text
    .replace(new RegExp(`^${AI_STUDENT_CODE}`), "L'élève")
    .split(AI_STUDENT_CODE)
    .join("l'élève");
}
