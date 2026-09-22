import Image from "next/image";
import { GraduationCap } from "lucide-react";
import type { ReportCard, ReportCardSubject } from "@/lib/report-card-compute";
import { MENTION_LABELS_FR } from "@/lib/report-card";
import { SECONDARY_OFFICIAL_SUBJECTS, officialSubjectIndex, roundHundredth } from "@/lib/grading";
import { formatLongDate, formatPhone } from "@/lib/format";
import styles from "./secondary-report-card.module.css";

/**
 * Bulletin du collège et du lycée, à l'image du bulletin officiel mauritanien
 * (maquette validée : brand-assets/madrasati-mvp-bulletin-v2.html).
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
}

/** 13,75 — virgule française, zéros inutiles retirés (42 et non 42,00). */
function score(value: number): string {
  return String(roundHundredth(value)).replace(".", ",");
}

/** 13,75 — toujours deux décimales, comme les moyennes du bulletin papier. */
function twoDecimals(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function rankLabel(rank: number | null, classSize: number): string {
  if (rank == null) return "—";
  return `${rank === 1 ? "1er" : `${rank}ème`} / ${classSize}`;
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

function Devoirs({ result }: { result: ReportCardSubject }) {
  const detail = result.secondary;
  if (!detail) return null;
  const shown = detail.devoirs
    .map((d, index) => ({ ...d, index }))
    .filter((d) => d.score != null || d.isAbsent);
  if (shown.length === 0) return null;

  return (
    <div className={styles.devoirs} data-testid="devoirs">
      {shown.map((d) => (
        <span
          key={d.index}
          className={d.index === detail.bestIndex ? styles.devoirBest : undefined}
          title={d.index === detail.bestIndex ? "Meilleur devoir, retenu pour la moyenne" : d.title}
          data-best={d.index === detail.bestIndex ? "" : undefined}
        >
          D{d.index + 1} {d.score != null ? score(d.score) : "Abs"}
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
}: SecondaryReportCardProps) {
  const rows = officialOrder(card.results);
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

      <div className={styles.title}>Bulletin de notes du Secondaire</div>

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
          <span>Trimestre</span>
          <strong>
            {termNumber}
            {yearLabel ? ` · ${yearLabel}` : ""}
          </strong>
        </div>
      </div>

      {/* TABLEAU DES NOTES — une seule ligne par matière */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.frRow}>
              <th className={styles.colSubject}>Disciplines</th>
              <th>Moy Int × 3</th>
              <th>Compt</th>
              <th>Moy T /20</th>
              <th>Coeff</th>
              <th>Note × Coeff</th>
              <th>Rang</th>
              <th>Observation des professeurs</th>
            </tr>
            <tr className={styles.arRow} lang="ar">
              <th className={styles.colSubject}>المواد</th>
              <th>معدل فردي×3</th>
              <th>التأليف</th>
              <th>معدل ف /20</th>
              <th>الضارب</th>
              <th>النقطة المرجحة</th>
              <th>الرتبة</th>
              <th>ملاحظات الأساتذة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = r.secondary;
              return (
                <tr key={r.subjectName} data-testid="subject-row" data-subject={r.subjectName}>
                  <td className={styles.subject}>
                    <div className={styles.subjectFr}>{r.subjectName}</div>
                    <div className={styles.subjectAr} lang="ar">
                      {arabicName(r)}
                    </div>
                  </td>
                  <td className={styles.times3} data-testid="times3">
                    {d?.bestTimes3 != null ? score(d.bestTimes3) : "—"}
                    <Devoirs result={r} />
                  </td>
                  <td data-testid="composition">
                    {d?.composition != null ? score(d.composition) : d?.compositionAbsent ? "Abs" : "—"}
                  </td>
                  <td data-testid="subject-average">
                    {r.average != null ? twoDecimals(r.average) : "—"}
                  </td>
                  <td data-testid="coefficient">{r.coefficient}</td>
                  <td className={styles.weighted} data-testid="weighted">
                    {d?.weighted != null ? twoDecimals(d.weighted) : "—"}
                  </td>
                  <td>{d?.rank ?? "—"}</td>
                  <td className={styles.observation}>{d?.observation ?? ""}</td>
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
              <td></td>
              <td></td>
              <td data-testid="general-average">
                {card.average != null ? twoDecimals(card.average) : "—"}
              </td>
              <td data-testid="total-coefficients">{card.totalCoefficients}</td>
              <td data-testid="total-points">
                {card.totalPoints != null ? twoDecimals(card.totalPoints) : "—"}
              </td>
              <td colSpan={2}>{rank}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.calcNote}>
        💡 <b>Moy Int × 3</b> = meilleur devoir retenu parmi ceux saisis, multiplié par 3 ·{" "}
        <b>Moy T /20</b> = (Moy Int ×3 + Compt) ÷ 4 · <b>Note × Coeff</b> = Moy T × Coeff —
        calculés automatiquement par Madrasati.
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
