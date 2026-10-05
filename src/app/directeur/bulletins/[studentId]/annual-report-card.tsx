import type { ReportCard, ReportCardSubject } from "@/lib/report-card-compute";
import { weightedOf } from "@/lib/report-card-compute";
import { SECONDARY_OFFICIAL_SUBJECTS, officialSubjectIndex, roundHundredth } from "@/lib/grading";
import { divisorOf, type Formula, type FormulaPart, type MultiRule } from "@/lib/grading-config";
import { MENTION_LABELS_FR } from "@/lib/report-card";
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
 * mêmes couleurs, même tableau à double en-tête ; il y ajoute les moyennes
 * des trimestres passés, les appréciations du conseil et la décision de
 * passage.
 *
 * Les colonnes de notes suivent la règle annuelle de l'école (par défaut,
 * celle confirmée par le directeur de l'École Ngalam : moyenne des meilleurs
 * devoirs de chaque trimestre × 3, compositions T1 × 1, T2 × 2, T3 × 3, ÷ 9),
 * chaque case avec le détail de son calcul en petit.
 */

export interface AnnualReportCardProps {
  id: string;
  card: ReportCard;
  school: SchoolIdentity;
  official: OfficialHeaderText;
  yearLabel: string | null;
  termRecap: TermRecap[];
  /**
   * Titre du document : « Bulletin Annuel » par défaut ; « Bulletin du 3e
   * trimestre » quand l'école a des bulletins cumulatifs (le 3e trimestre
   * est alors son bulletin annuel).
   */
  title?: string;
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
 * Une case de note : la valeur pondérée (« 45 »), et en petit dessous le
 * calcul qui y mène — « (14+16+15)÷3×3 » pour les devoirs de l'année,
 * « 13×2 » pour une composition comptée deux fois.
 */
function partCell(part: FormulaPart, detail: { scores: (number | null)[]; value: number | null; weighted: number | null } | undefined) {
  if (!detail || detail.weighted == null || detail.value == null) return EMPTY;
  const notes = detail.scores.filter((s): s is number => s != null);
  let calc: string | null = null;
  if (part.multiple === "AVERAGE" && notes.length > 1) {
    calc = `(${notes.map(score).join("+")})÷${notes.length}${part.weight !== 1 ? `×${part.weight}` : ""}`;
  } else if (part.weight !== 1) {
    calc = `${score(detail.value)}×${part.weight}`;
  }
  return (
    <>
      {score(detail.weighted)}
      {calc && <span className={styles.calcDetail}>{calc}</span>}
    </>
  );
}

const RULE_FR: Record<MultiRule, string> = {
  BEST: "meilleure note",
  AVERAGE: "moyenne",
  SUM: "somme",
  LAST: "dernière note",
};
const PER_TERM_FR: Record<MultiRule, string> = {
  BEST: "meilleurs devoirs",
  AVERAGE: "moyennes de devoirs",
  SUM: "totaux de devoirs",
  LAST: "derniers devoirs",
};

/**
 * La formule de l'école en clair, sous le tableau : « Moy Int × 3 = moyenne
 * des meilleurs devoirs de chaque trimestre × 3 · Moy T /20 = (…) ÷ 9 ».
 */
function formulaNote(formula: Formula): string {
  const explained = formula.parts
    .filter((p) => p.perTerm)
    .map((p) => `${header(p)} = ${RULE_FR[p.multiple]} des ${PER_TERM_FR[p.perTerm!]} de chaque trimestre${p.weight !== 1 ? ` × ${p.weight}` : ""}`);
  const average = `Moy T /20 = (${formula.parts.map(header).join(" + ")}) ÷ ${divisorOf(formula)}`;
  return [...explained, average, "Notes × Coeff = Moy T × Coeff"].join(" · ");
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
  termRecap,
  title,
  honors,
  decision,
  suggestion,
  issuedAt,
  incomplete,
}: AnnualReportCardProps) {
  const rows = officialOrder(card.results);
  const parts = card.formula.parts;
  const rank = rankLabel(card.rank, card.classSize);
  const highlight = decision
    ? `✓ Décision : ${decisionText(decision, card.className)}`
    : suggestion
      ? `✓ Suggestion automatique : ${decisionText(suggestion, card.className)} — modifiable par la direction`
      : null;
  const ordinal = (term: string) => {
    const n = term.match(/\d/)?.[0];
    return n ? `${n}° trimestre` : term;
  };

  return (
    <div id={id} className={`${styles.bulletin} ${styles.annual}`} dir="ltr" lang="fr" data-testid="annual-report-card" data-pdf-single-page>
      <DocumentHeader school={school} official={official} />

      <div className={styles.annualTitleRow}>
        <div className={styles.annualTitle}>{title ?? "Bulletin de notes — fin d'année"}</div>
        <div className={styles.annualBadge}>Bulletin annuel</div>
      </div>
      <div className={styles.annualSub}>
        {yearLabel ? `Année scolaire ${yearLabel} · ` : ""}Récapitulatif de l&apos;année, généré automatiquement par
        Madrasati
      </div>

      <div className={styles.studentInfo}>
        <div>
          <span>Nom et Prénom</span>
          <strong>
            {card.student.firstName} {card.student.lastName}
          </strong>
        </div>
        <div>
          <span>Classe</span>
          <strong>{card.className}</strong>
        </div>
        <div>
          <span>Effectif</span>
          <strong>{card.classSize}</strong>
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
              <th>Moy T /20</th>
              <th>Coeff</th>
              <th>Notes × Coeff</th>
              <th>Observation des professeurs</th>
            </tr>
            <tr className={styles.arRow} lang="ar">
              <th className={styles.colSubject}>المواد</th>
              {parts.map((part) => (
                <th key={part.id}>{part.columnLabelAr ?? ""}</th>
              ))}
              <th>المعدل /20</th>
              <th>الضارب</th>
              <th>النقاط المرجحة</th>
              <th>ملاحظات الأساتذة</th>
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
                        {partCell(part, detail)}
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
                  <td className={styles.observation}>{r.detail.observation ?? ""}</td>
                </tr>
              );
            })}
            <tr className={styles.totalRow}>
              <td className={styles.subject}>
                <div className={styles.subjectFr}>Total</div>
                <div className={styles.subjectAr} lang="ar">
                  المجموع
                </div>
              </td>
              {parts.map((part) => (
                <td key={part.id}></td>
              ))}
              <td></td>
              <td data-testid="total-coefficients">{card.totalCoefficients}</td>
              <td data-testid="total-points">
                {card.totalPoints != null ? twoDecimals(card.totalPoints) : EMPTY}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.calcNote} data-testid="formula-note">
        💡 {formulaNote(card.formula)}. Les matières et leurs coefficients sont ceux de la classe.
      </div>

      {/* Les trimestres passés, repris des bulletins déjà établis, puis l'année */}
      <div
        className={`${styles.trimRecap} ${termRecap.length === 2 ? styles.trimRecapThree : ""}`}
        data-testid="term-recap"
      >
        {termRecap.map((t) => (
          <div key={t.term} className={styles.trimCard} data-testid="term-recap-card">
            <div className={styles.trimLabel}>Moyenne {ordinal(t.term)}</div>
            <div className={styles.trimValue}>{t.average != null ? twoDecimals(t.average) : "—"}</div>
            <div className={styles.trimCoef}>Récupérée automatiquement</div>
          </div>
        ))}
        <div className={`${styles.trimCard} ${styles.trimCardAnnual}`}>
          <div className={styles.trimLabel}>Moyenne générale annuelle</div>
          <div className={styles.trimValue} data-testid="annual-average">
            {card.average != null ? `${twoDecimals(card.average)}/20` : "—"}
          </div>
          <div className={styles.trimCoef}>
            {card.average != null ? `${MENTION_LABELS_FR[card.mention]} · ` : ""}Rang {rank}
          </div>
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

      <div className={styles.directorNote}>
        <b>Observations du directeur :</b> <span className={styles.directorLine} />
      </div>

      <div className={styles.signatures}>
        <div>Le Directeur</div>
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
