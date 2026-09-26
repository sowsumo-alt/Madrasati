import type { ReportCard, ReportCardSubject } from "@/lib/report-card-compute";
import { weightedOf } from "@/lib/report-card-compute";
import { SECONDARY_OFFICIAL_SUBJECTS, officialSubjectIndex, roundHundredth } from "@/lib/grading";
import type { FormulaPart } from "@/lib/grading-config";
import {
  DECISIONS,
  HONORS,
  nextClassLabel,
  type DecisionKey,
  type HonorKey,
} from "@/lib/annual-decision";
import type { TermRecap } from "@/lib/report-card-data";
import { formatLongDate } from "@/lib/format";
import type { OfficialHeaderText, SchoolIdentity } from "@/lib/official-header";
import { DocumentHeader } from "@/components/documents/document-header";
import styles from "./secondary-report-card.module.css";

/**
 * Bulletin annuel du collège et du lycée, établi à la fin du 3e trimestre —
 * reproduction de la maquette validée (brand-assets/madrasati-mvp-bulletin-
 * annuel.html). Même famille que le bulletin trimestriel : mêmes en-têtes,
 * mêmes couleurs, même tableau ; il y ajoute le récapitulatif des trois
 * trimestres, les appréciations du conseil et la décision de passage.
 *
 * Les colonnes de notes suivent la règle annuelle de l'école (par défaut :
 * meilleur devoir de l'année × 3, compositions T1 × 1, T2 × 2, T3 × 3, ÷ 9).
 */

export interface AnnualReportCardProps {
  id: string;
  card: ReportCard;
  school: SchoolIdentity;
  official: OfficialHeaderText;
  yearLabel: string | null;
  studentNumber: number;
  termRecap: TermRecap[];
  honors: HonorKey[];
  /** Décision validée par le directeur ; null tant qu'il n'a rien choisi. */
  decision: DecisionKey | null;
  /** Suggestion de Madrasati d'après le seuil de l'école. */
  suggestion: DecisionKey | null;
  issuedAt: Date;
  incomplete?: boolean;
}

function score(value: number): string {
  return String(roundHundredth(value)).replace(".", ",");
}

function twoDecimals(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

const EMPTY = <span className={styles.empty}>—</span>;

function rankLabel(rank: number | null, classSize: number): string {
  if (rank == null) return "—";
  return `${rank === 1 ? "1er" : `${rank}ème`} / ${classSize}`;
}

function officialOrder(results: ReportCardSubject[]): ReportCardSubject[] {
  return [...results].sort((a, b) => {
    const ia = officialSubjectIndex(a.subjectName) ?? SECONDARY_OFFICIAL_SUBJECTS.length;
    const ib = officialSubjectIndex(b.subjectName) ?? SECONDARY_OFFICIAL_SUBJECTS.length;
    return ia - ib || a.subjectName.localeCompare(b.subjectName, "fr");
  });
}

function arabicName(result: ReportCardSubject): string {
  if (result.subjectNameAr) return result.subjectNameAr;
  const index = officialSubjectIndex(result.subjectName);
  return index == null ? "" : SECONDARY_OFFICIAL_SUBJECTS[index].nameAr;
}

function header(part: FormulaPart): string {
  return part.columnLabel ?? (part.weight === 1 ? part.label : `${part.label} ×${part.weight}`);
}

/**
 * Une composition pondérée s'écrit comme sur la maquette, « 13×2=26 » ; le
 * meilleur devoir et une composition simple, par leur seule valeur.
 */
function partCell(part: FormulaPart, value: number | null, weighted: number | null) {
  if (value == null || weighted == null) return EMPTY;
  if (part.multiple === "LAST" && part.weight !== 1) {
    return `${score(value)}×${part.weight}=${score(weighted)}`;
  }
  return score(weighted);
}

/** « Passage en 2AS », « Redoublement », « Autorisé(e) ». */
function decisionText(key: DecisionKey, className: string): string {
  if (key === "PROMOTED") {
    const next = nextClassLabel(className);
    return next ? `Passage en ${next}` : "Passage en classe supérieure";
  }
  if (key === "REPEAT") return "Redoublement";
  return "Autorisé(e)";
}

export function AnnualReportCard({
  id,
  card,
  school,
  official,
  yearLabel,
  studentNumber,
  termRecap,
  honors,
  decision,
  suggestion,
  issuedAt,
  incomplete,
}: AnnualReportCardProps) {
  const rows = officialOrder(card.results);
  const parts = card.formula.parts;
  const rank = rankLabel(card.rank, card.classSize);
  const divisor =
    card.formula.divisor.mode === "FIXED"
      ? card.formula.divisor.value
      : parts.reduce((sum, p) => sum + p.weight, 0);
  // Le poids de la composition de chaque trimestre, pour le récapitulatif.
  const weightOfTerm = (term: string) =>
    parts.find((p) => p.term === term && p.kinds.includes("COMPOSITION"))?.weight ?? null;
  const highlight = decision
    ? `✓ Décision : ${decisionText(decision, card.className)}`
    : suggestion
      ? `✓ Suggestion : ${decisionText(suggestion, card.className)}`
      : null;

  return (
    <div id={id} className={styles.bulletin} dir="ltr" lang="fr" data-testid="annual-report-card">
      <DocumentHeader school={school} official={official} />

      <div className={styles.annualTitleRow}>
        <div className={styles.annualTitle}>Bulletin Annuel</div>
        {yearLabel && <div className={styles.annualBadge}>Année {yearLabel}</div>}
      </div>
      <div className={styles.annualSub}>
        Récapitulatif des 3 trimestres — Généré automatiquement par Madrasati
      </div>

      <div className={styles.studentInfo}>
        <div>
          <span>Nom et Prénom</span>
          <strong>
            {card.student.firstName} {card.student.lastName}
          </strong>
        </div>
        <div>
          <span>N°</span>
          <strong>{String(studentNumber).padStart(2, "0")}</strong>
        </div>
        <div>
          <span>Classe</span>
          <strong>{card.className}</strong>
        </div>
        <div>
          <span>Année scolaire</span>
          <strong>{yearLabel ?? "—"}</strong>
        </div>
      </div>

      {/* Les trois trimestres, puis la moyenne annuelle */}
      <div className={styles.trimRecap} data-testid="term-recap">
        {termRecap.map((t) => {
          const weight = weightOfTerm(t.term);
          return (
            <div key={t.term} className={styles.trimCard} data-testid="term-recap-card">
              <div className={styles.trimLabel}>{t.term}</div>
              <div className={styles.trimValue}>{t.average != null ? twoDecimals(t.average) : "—"}</div>
              {weight != null && <div className={styles.trimCoef}>Poids ×{weight}</div>}
            </div>
          );
        })}
        <div className={`${styles.trimCard} ${styles.trimCardAnnual}`}>
          <div className={styles.trimLabel}>Moyenne Annuelle</div>
          <div className={styles.trimValue} data-testid="annual-average">
            {card.average != null ? `${twoDecimals(card.average)}/20` : "—"}
          </div>
          <div className={styles.trimCoef}>Pondérée</div>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.annualTable}`}>
          <thead>
            <tr className={styles.frRow}>
              <th className={styles.colSubject}>Disciplines</th>
              {parts.map((part) => (
                <th key={part.id}>{header(part)}</th>
              ))}
              <th>Moy Annuelle /20</th>
              <th>Coeff</th>
              <th>Note × Coeff</th>
              <th>Rang</th>
            </tr>
            <tr className={styles.arRow} lang="ar">
              <th className={styles.colSubject}>المواد</th>
              {parts.map((part) => (
                <th key={part.id}>{part.columnLabelAr ?? ""}</th>
              ))}
              <th>المعدل السنوي</th>
              <th>الضارب</th>
              <th>النقطة المرجحة</th>
              <th>الرتبة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const weighted = weightedOf(r);
              return (
                <tr key={r.subjectName} data-testid="subject-row" data-subject={r.subjectName}>
                  <td className={styles.subject}>
                    <div className={styles.subjectFr}>{r.subjectName}</div>
                    <div className={styles.subjectAr} lang="ar">
                      {arabicName(r)}
                    </div>
                  </td>
                  {parts.map((part, index) => {
                    const detail = r.detail.parts[index];
                    return (
                      <td
                        key={part.id}
                        className={index === 0 ? styles.times3 : styles.compo}
                        data-testid={`part-${index}`}
                      >
                        {partCell(part, detail?.value ?? null, detail?.weighted ?? null)}
                      </td>
                    );
                  })}
                  <td className={styles.moyt} data-testid="subject-average">
                    {r.average != null ? twoDecimals(r.average) : EMPTY}
                  </td>
                  <td data-testid="coefficient">{r.coefficient}</td>
                  <td className={styles.weighted} data-testid="weighted">
                    {weighted != null ? twoDecimals(weighted) : EMPTY}
                  </td>
                  <td>{r.detail.rank ?? EMPTY}</td>
                </tr>
              );
            })}
            <tr className={styles.totalRow}>
              <td className={styles.subject}>
                <div className={styles.subjectFr}>Moyenne Générale Annuelle</div>
                <div className={styles.subjectAr} lang="ar">
                  المعدل العام السنوي
                </div>
              </td>
              {parts.map((part) => (
                <td key={part.id}></td>
              ))}
              <td data-testid="general-average">
                {card.average != null ? twoDecimals(card.average) : EMPTY}
              </td>
              <td data-testid="total-coefficients">{card.totalCoefficients}</td>
              <td data-testid="total-points">
                {card.totalPoints != null ? twoDecimals(card.totalPoints) : EMPTY}
              </td>
              <td>{rank}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.calcNote}>
        💡 Formule : ({parts.map((p) => `${p.label} ×${p.weight}`).join(" + ")}) ÷ {divisor}. Les
        moyennes des Trimestres 1 et 2 sont récupérées automatiquement depuis les bulletins déjà
        générés.
      </div>

      <div className={styles.synthese2}>
        <div className={styles.synthCard}>
          <div className={styles.synthLabel}>Moyenne générale annuelle</div>
          <div className={styles.synthValue}>
            {card.average != null ? `${twoDecimals(card.average)}/20` : "—"}
          </div>
        </div>
        <div className={styles.synthCard}>
          <div className={styles.synthLabel}>Rang annuel</div>
          <div className={styles.synthValue}>{rank}</div>
        </div>
      </div>

      <div className={styles.bottomGrid}>
        <div className={styles.bottomBox} data-testid="council">
          <div className={styles.bottomTitle}>Appréciations du conseil des professeurs</div>
          {HONORS.map((h) => (
            <div key={h.key} className={styles.checkItem} data-checked={honors.includes(h.key) ? "" : undefined}>
              <span className={`${styles.checkBox} ${honors.includes(h.key) ? styles.checkBoxOn : ""}`} />
              {h.fr}
              <span className={styles.checkAr} lang="ar">
                {h.ar}
              </span>
            </div>
          ))}
        </div>
        <div className={styles.bottomBox} data-testid="decision">
          <div className={styles.bottomTitle}>Décision de passage</div>
          {DECISIONS.map((d) => (
            <div key={d.key} className={styles.checkItem} data-checked={decision === d.key ? "" : undefined}>
              <span className={`${styles.checkBox} ${decision === d.key ? styles.checkBoxOn : ""}`} />
              {d.fr}
            </div>
          ))}
          {highlight && (
            <div className={styles.decisionHighlight} data-testid="decision-highlight">
              {highlight}
            </div>
          )}
        </div>
      </div>

      <div className={styles.signatures}>
        <div>Le Directeur Général</div>
        <div>Le Tuteur</div>
        <div>Le Directeur des Études</div>
      </div>

      {incomplete && (
        <p className={styles.incomplete} data-testid="incomplete-mention">
          Certaines notes n&apos;étaient pas disponibles à la génération de ce bulletin.
        </p>
      )}

      <div className={styles.footerDate}>
        {school.city ? `${school.city}, le ${formatLongDate(issuedAt)}` : `Le ${formatLongDate(issuedAt)}`}
      </div>
      <div className={styles.footerNote}>
        Nota : Il n&apos;est délivré qu&apos;un seul Bulletin de Notes ; il appartient à
        l&apos;intéressé(e) d&apos;en faire des photocopies légalisées.
      </div>
    </div>
  );
}
