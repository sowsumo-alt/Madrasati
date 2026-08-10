import { GoogleGenAI } from "@google/genai";
import type { ReportCard } from "@/lib/report-card-data";

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

Fournis ensuite la traduction fidèle de cette même phrase en arabe littéraire.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    fr: { type: "string", description: "L'appréciation, une seule phrase en français." },
    ar: { type: "string", description: "La même phrase traduite en arabe littéraire." },
  },
  required: ["fr", "ar"],
} as const;

function formatCard(card: ReportCard) {
  const lines = card.results.map((r) => {
    const own = r.average != null ? r.average.toFixed(2) : "aucune note";
    const cls = r.classAverage != null ? r.classAverage.toFixed(2) : "—";
    return `- ${r.subjectName} (coefficient ${r.coefficient}) : ${own}/20 ; moyenne de la classe ${cls}/20`;
  });

  return [
    `Élève : ${card.student.firstName} ${card.student.lastName}`,
    `Classe : ${card.className}`,
    `Période : ${card.term}`,
    `Moyenne générale pondérée : ${card.average != null ? `${card.average.toFixed(2)}/20` : "non calculable"}`,
    `Mention : ${card.mention}`,
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
    contents: formatCard(card),
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

  const fr = parsed.fr?.trim();
  if (!fr) throw new Error("Réponse incomplète. Réessayez.");

  return { fr, ar: parsed.ar?.trim() ?? "" };
}
