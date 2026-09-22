import Image from "next/image";
import { GraduationCap } from "lucide-react";
import type { ReportCard, ReportCardSubject } from "@/lib/report-card-compute";
import { weightedOf } from "@/lib/report-card-compute";
import { MENTION_LABELS_FR } from "@/lib/report-card";
import { SECONDARY_OFFICIAL_SUBJECTS, officialSubjectIndex, roundHundredth } from "@/lib/grading";
import type { FormulaPart } from "@/lib/grading-config";
import { formatLongDate, formatPhone } from "@/lib/format";
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
  school: {
    name: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    logoUrl: string | null;
  };
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

export function SecondaryReportCard({
  id,
  card,
  school,
  yearLabel,
  studentNumber,
  suspensions,
  comment,
  issuedAt,
  title,
  periodLabel,
}: SecondaryReportCardProps) {
  const rows = officialOrder(card.results);
  const parts = card.formula.parts;
  const termNumber = card.term.replace(/\D/g, "") || card.term;
  const rank = rankLabel(card.rank, card.classSize);
  const place = [school.address, school.city]
    .filter((part): part is string => Boolean(part?.trim()))
    .filter((part, i, parts) => i === 0 || !parts[0].toLowerCase().includes(part.toLowerCase()));
  const meta = (
    place.some((part) => /mauritanie/i.test(part)) ? place : [...place, "Mauritanie"]
  ).join(", ");
  const phone = school.phone ? formatPhone(school.phone) : null;
  const date = formatLongDate(issuedAt);

  return (
    <div id={id} className={styles.bulletin} dir="ltr" lang="fr" data-testid="secondary-report-card">
      {/* BLOC OFFICIEL MAURITANIEN */}
      <div className={styles.officialHeader}>
        <div className={styles.officialFr}>
          <div className={styles.line1}>République Islamique de Mauritanie</div>
          <div>Honneur — Fraternité — Justice</div>
          <div>Ministère de l&apos;Éducation Nationale</div>
          <div>Direction de l&apos;Enseignement Fondamental et Secondaire</div>
        </div>
        <div className={styles.crest}>
          {school.logoUrl ? (
            <Image
              src={school.logoUrl}
              alt=""
              width={104}
              height={104}
              unoptimized
              className={styles.crestLogo}
            />
          ) : (
            <GraduationCap className="h-6 w-6" strokeWidth={2} aria-hidden />
          )}
        </div>
        <div className={styles.officialAr} lang="ar">
          <div className={styles.line1}>الجمهورية الإسلامية الموريتانية</div>
          <div>شرف – إخاء – عدالة</div>
          <div>وزارة التهذيب الوطني</div>
          <div>مديرية التعليم الأساسي والثانوي</div>
        </div>
      </div>

      {/* EN-TÊTE DE L'ÉCOLE (depuis Paramètres) */}
      <div className={styles.schoolHeader}>
        <div className={styles.schoolName}>{school.name}</div>
        <div className={styles.schoolMeta}>
          {meta}
          {phone && <> · <span dir="ltr">{phone}</span></>}
        </div>
      </div>

      <div className={styles.title}>{title ?? "Bulletin de notes du Secondaire"}</div>

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
              <th>Moy T /20</th>
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
              <th>معدل ف /20</th>
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
        💡 {formulaNote(card)} — calculés automatiquement par Madrasati, selon la règle de
        calcul enregistrée par l&apos;école.
      </div>

      {/* SYNTHÈSE */}
      <div className={styles.synthese}>
        <div className={styles.synthCard}>
          <div className={styles.synthLabel}>Moyenne générale</div>
          <div className={styles.synthValue}>
            {card.average != null ? `${twoDecimals(card.average)}/20` : "—"}
          </div>
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

      {/* SIGNATURES */}
      <div className={styles.signatures}>
        <div>Le Directeur Général</div>
        <div>Le Tuteur</div>
        <div>Le Directeur des Études</div>
      </div>

      <div className={styles.footerDate}>
        {school.city ? `${school.city}, le ${date}` : `Le ${date}`}
      </div>
    </div>
  );
}

/** La phrase d'explication sous le tableau, écrite d'après la formule de l'école. */
function formulaNote(card: ReportCard) {
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
      <b>Moy T /20</b> = tout cela additionné, ÷ {divisor} · <b>Note × Coeff</b> = Moy T ×
      Coeff
    </>
  );
}
