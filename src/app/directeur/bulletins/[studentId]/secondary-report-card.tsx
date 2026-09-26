import type { ReportCard, ReportCardSubject } from "@/lib/report-card-compute";
import { weightedOf } from "@/lib/report-card-compute";
import { MENTION_LABELS_FR } from "@/lib/report-card";
import { SECONDARY_OFFICIAL_SUBJECTS, officialSubjectIndex, roundHundredth } from "@/lib/grading";
import type { FormulaPart } from "@/lib/grading-config";
import { formatDelta, type CardEvolution, type Evolution } from "@/lib/report-card-checks";
import { formatLongDate } from "@/lib/format";
import type { OfficialHeaderText, SchoolIdentity } from "@/lib/official-header";
import { DocumentHeader } from "@/components/documents/document-header";
import styles from "./secondary-report-card.module.css";

/**
 * Bulletin du collège et du lycée, à l'image du bulletin officiel mauritanien
 * (maquette validée : brand-assets/madrasati-mvp-bulletin-v2.html).
 *
 * Les colonnes de notes ne sont pas fixées ici : elles suivent la règle de
 * calcul de l'école (un bloc = une colonne). L'école qui garde le modèle par
 * défaut retrouve « Moy Int × 3 » et « Compt » ; celle qui compte autrement
 * voit ses propres colonnes.
 *
 * Toujours en français et en arabe, quelle que soit la langue de
 * l'interface : c'est le document officiel que les parents connaissent.
 * Le Fondamental garde son propre bulletin (voir page.tsx).
 */

export interface SecondaryReportCardProps {
  id: string;
  card: ReportCard;
  school: SchoolIdentity;
  /** Bloc de l'État, commun à toutes les écoles (voir loadOfficialHeader). */
  official: OfficialHeaderText;
  yearLabel: string | null;
  /** Place de l'élève dans la liste alphabétique de la classe. */
  studentNumber: number;
  /** Renvois (exclusions temporaires) du trimestre. */
  suspensions: number;
  comment: { body: string; bodyAr: string | null } | null;
  issuedAt: Date;
  /** Intitulé du document ; « Bulletin de notes du Secondaire » par défaut. */
  title?: string;
  /** Intitulé de la période : « 1 · 2026-2027 », ou « Année 2026-2027 ». */
  periodLabel?: string;
  /** Évolution depuis le trimestre précédent ; absente au premier trimestre. */
  evolution?: CardEvolution | null;
  /** Vrai s'il manquait des notes quand le bulletin a été établi. */
  incomplete?: boolean;
}

const TREND_ARROW = { UP: "↗", DOWN: "↘", STABLE: "→" } as const;

/** Flèche et écart, en vert si l'élève progresse, en rouge s'il recule. */
function Trend({ value, long }: { value: Evolution; long?: boolean }) {
  const className =
    value.trend === "UP" ? styles.trendUp : value.trend === "DOWN" ? styles.trendDown : styles.trendStable;
  return (
    <span className={className} data-testid={long ? "general-evolution" : "subject-evolution"}>
      {TREND_ARROW[value.trend]}{" "}
      {value.trend === "STABLE" ? "stable" : formatDelta(value.delta)}
      {long ? ` par rapport au ${value.previousTerm}` : ""}
    </span>
  );
}

/** 13,75 — virgule française, zéros inutiles retirés (42 et non 42,00). */
function score(value: number): string {
  return String(roundHundredth(value)).replace(".", ",");
}

/** 13,75 — toujours deux décimales, comme les moyennes du bulletin papier. */
function twoDecimals(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/** Case sans valeur : un tiret gris, discret à côté des notes. */
const EMPTY = <span className={styles.empty}>—</span>;

function rankLabel(rank: number | null, classSize: number): string {
  if (rank == null) return "—";
  return `${rank === 1 ? "1er" : `${rank}ème`} / ${classSize}`;
}

/** En-tête de la colonne d'un bloc : « Moy Int × 3 », ou le nom du bloc. */
function columnHeader(part: FormulaPart): string {
  if (part.columnLabel) return part.columnLabel;
  return part.weight === 1 ? part.label : `${part.label} × ${part.weight}`;
}

/** L'ordre du bulletin officiel (Arabe, Français, Anglais…), puis les autres matières. */
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

/**
 * Les notes du bloc sous sa valeur — « D1 12 · D2 14 » —, celle qui a été
 * retenue soulignée. Rien à afficher quand le bloc n'a qu'une note, qui est
 * déjà la valeur de la colonne.
 */
function PartScores({ result, index }: { result: ReportCardSubject; index: number }) {
  const part = result.detail.parts[index];
  const shown = (part?.scores ?? [])
    .map((value, position) => ({ value, position }))
    .filter((s) => s.value != null);
  if (!part || shown.length < 2) return null;

  return (
    <div className={styles.devoirs} data-testid="part-scores">
      {shown.map((s) => (
        <span
          key={s.position}
          className={s.position === part.usedIndex ? styles.devoirBest : undefined}
          data-best={s.position === part.usedIndex ? "" : undefined}
          title={result.detail.titles[index]?.[s.position]}
        >
          D{s.position + 1} {score(s.value as number)}
        </span>
      ))}
    </div>
  );
}

/** « Bulletin du 1er trimestre », « Bulletin du 2e trimestre »… */
export function termTitle(term: string): string {
  const n = Number(term.replace(/\D/g, ""));
  if (!n) return "Bulletin de notes";
  return `Bulletin du ${n === 1 ? "1er" : `${n}e`} trimestre`;
}

export function SecondaryReportCard({
  id,
  card,
  school,
  official,
  yearLabel,
  studentNumber,
  suspensions,
  comment,
  issuedAt,
  title,
  periodLabel,
  evolution,
  incomplete,
}: SecondaryReportCardProps) {
  const averageHeader = "Moy T /20";
  const averageHeaderAr = "معدل ف /20";
  const rows = officialOrder(card.results);
  const parts = card.formula.parts;
  const termNumber = card.term.replace(/\D/g, "") || card.term;
  const rank = rankLabel(card.rank, card.classSize);
  const date = formatLongDate(issuedAt);

  return (
    <div id={id} className={styles.bulletin} dir="ltr" lang="fr" data-testid="secondary-report-card">
      <DocumentHeader school={school} official={official} />

      <div className={styles.title}>{title ?? termTitle(card.term)}</div>

      {/* INFORMATIONS DE L'ÉLÈVE */}
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
          <span>{periodLabel ? "Période" : "Trimestre"}</span>
          <strong>
            {periodLabel ?? `${termNumber}${yearLabel ? ` · ${yearLabel}` : ""}`}
          </strong>
        </div>
      </div>

      {/* TABLEAU DES NOTES — une seule ligne par matière */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.frRow}>
              <th className={styles.colSubject}>Disciplines</th>
              {parts.map((part) => (
                <th key={part.id}>{columnHeader(part)}</th>
              ))}
              <th>{averageHeader}</th>
              <th>Coeff</th>
              <th>Note × Coeff</th>
              <th>Rang</th>
              <th>Observation des professeurs</th>
            </tr>
            <tr className={styles.arRow} lang="ar">
              <th className={styles.colSubject}>المواد</th>
              {parts.map((part) => (
                <th key={part.id}>{part.columnLabelAr ?? ""}</th>
              ))}
              <th>{averageHeaderAr}</th>
              <th>الضارب</th>
              <th>النقطة المرجحة</th>
              <th>الرتبة</th>
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
                    const value = r.detail.parts[index]?.weighted ?? null;
                    return (
                      <td
                        key={part.id}
                        className={index === 0 ? styles.times3 : undefined}
                        data-testid={`part-${index}`}
                      >
                        {value != null ? score(value) : EMPTY}
                        <PartScores result={r} index={index} />
                      </td>
                    );
                  })}
                  <td data-testid="subject-average">
                    {r.average != null ? twoDecimals(r.average) : EMPTY}
                    {evolution?.bySubject[r.subjectName] && (
                      <div className={styles.subjectTrend}>
                        <Trend value={evolution.bySubject[r.subjectName]} />
                      </div>
                    )}
                  </td>
                  <td data-testid="coefficient">{r.coefficient}</td>
                  <td className={styles.weighted} data-testid="weighted">
                    {weighted != null ? twoDecimals(weighted) : EMPTY}
                  </td>
                  <td>{r.detail.rank ?? EMPTY}</td>
                  <td className={styles.observation}>{r.detail.observation ?? ""}</td>
                </tr>
              );
            })}
            <tr className={styles.totalRow}>
              <td className={styles.subject}>
                <div className={styles.subjectFr}>Moyenne Générale</div>
                <div className={styles.subjectAr} lang="ar">
                  المعدل العام
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
              <td colSpan={2}>{rank}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.calcNote}>
        💡 {formulaNote(card, averageHeader)} — calculés automatiquement par Madrasati, selon
        la règle de calcul enregistrée par l&apos;école.
      </div>

      {/* SYNTHÈSE */}
      <div className={styles.synthese}>
        <div className={styles.synthCard}>
          <div className={styles.synthLabel}>Moyenne générale</div>
          <div className={styles.synthValue}>
            {card.average != null ? `${twoDecimals(card.average)}/20` : "—"}
          </div>
          {evolution?.general && (
            <div className={styles.generalTrend}>
              <Trend value={evolution.general} long />
            </div>
          )}
        </div>
        <div className={styles.synthCard}>
          <div className={styles.synthLabel}>Mention</div>
          <div className={`${styles.synthValue} ${styles.synthMention}`}>
            {MENTION_LABELS_FR[card.mention]}
          </div>
        </div>
        <div className={styles.synthCard}>
          <div className={styles.synthLabel}>Rang</div>
          <div className={styles.synthValue}>{rank}</div>
        </div>
      </div>

      {/* CONDUITE */}
      <div className={styles.conduct}>
        <b>Conduite :</b> Nombre de renvois : {suspensions} — Nombre d&apos;absences :{" "}
        {card.attendance.absent} — Nombre de retards : {card.attendance.late}
        <br />
        {/* Le conseil tranche en séance : la décision se coche à la main. */}
        <b>Décision du conseil des professeurs :</b> ☐ Félicitations · ☐ Encouragements · ☐
        Avertissement · ☐ Blâme
        <br />
        <b>Observation générale :</b> {comment?.body ?? ""}
        {comment?.bodyAr && (
          <div className={styles.conductAr} lang="ar">
            {comment.bodyAr}
          </div>
        )}
      </div>

      {/* Bulletin établi alors que des notes manquaient : on le dit, discrètement. */}
      {incomplete && (
        <p className={styles.incomplete} data-testid="incomplete-mention">
          Certaines notes n&apos;étaient pas disponibles à la génération de ce bulletin.
        </p>
      )}

      <div className={styles.footerDate}>
        {school.city ? `${school.city}, le ${date}` : `Le ${date}`}
      </div>
    </div>
  );
}

/** La phrase d'explication sous le tableau, écrite d'après la formule de l'école. */
function formulaNote(card: ReportCard, averageHeader: string) {
  const terms = card.formula.parts.map((part) => {
    const rule =
      part.multiple === "BEST"
        ? "la meilleure note"
        : part.multiple === "AVERAGE"
          ? "la moyenne des notes"
          : part.multiple === "SUM"
            ? "la somme des notes"
            : "la dernière note";
    const times = part.weight === 1 ? "" : ` × ${part.weight}`;
    return `${columnHeader(part)} = ${rule} de « ${part.label} »${times}`;
  });
  const divisor =
    card.formula.divisor.mode === "FIXED"
      ? card.formula.divisor.value
      : card.formula.parts.reduce((sum, p) => sum + p.weight, 0);

  return (
    <>
      {terms.map((text, i) => (
        <span key={i}>
          {i > 0 && " · "}
          <b>{text.split(" = ")[0]}</b> = {text.split(" = ").slice(1).join(" = ")}
        </span>
      ))}
      {" · "}
      <b>{averageHeader}</b> = tout cela additionné, ÷ {divisor} · <b>Note × Coeff</b> ={" "}
      {averageHeader.replace(" /20", "")} × Coeff
    </>
  );
}
