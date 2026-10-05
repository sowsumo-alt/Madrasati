import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { loadMarkSheets, type MarkSheet, type MarkSheetsData } from "@/lib/mark-sheet-data";
import { paginateRows, STUDENT_ORDERS, type StudentOrder } from "@/lib/mark-sheet";
import { schoolPhoneLine, schoolPlaceLine } from "@/lib/official-header";
import { PrintButton } from "@/components/ui/print-button";
import { TERMS } from "../schema";
import styles from "./mark-sheet.module.css";

/** Lignes par page A4 (voir les hauteurs de mark-sheet.module.css). */
const ROWS_PER_PAGE = 24;
/** Dernière page : de la place pour la date et la signature. */
const ROWS_LAST_PAGE = 20;
/** Largeur utile de la page, en millimètres. */
const PAGE_WIDTH = 190;

/**
 * Feuilles de notes à imprimer : une par matière, la liste des élèves déjà
 * écrite, des cases vides pour les notes selon la règle de calcul de
 * l'école. L'enseignant les remplit à la main ; le directeur saisit ensuite
 * les notes dans Notes, dans le même ordre.
 */
export default async function MarkSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ classe?: string; matiere?: string; trimestre?: string; ordre?: string; notes?: string }>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const params = await searchParams;
  const term = TERMS.find((t) => t === params.trimestre);
  if (!params.classe || !params.matiere || !term) notFound();
  const order: StudentOrder = (STUDENT_ORDERS as readonly string[]).includes(params.ordre ?? "")
    ? (params.ordre as StudentOrder)
    : "NUMBER";

  const data = await loadMarkSheets({
    schoolId: user.schoolId,
    classId: params.classe,
    subjectId: params.matiere,
    term,
    order,
    prefill: params.notes === "1",
  });
  if (!data) notFound();

  const studentCount = data.sheets[0]?.rows.length ?? 0;
  const pageCount = data.sheets.reduce(
    (sum, s) => sum + paginateRows(s.rows.length, ROWS_PER_PAGE, ROWS_LAST_PAGE).length,
    0,
  );

  return (
    <div className="mx-auto max-w-[62rem] pb-10">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/directeur/examens"
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground/55 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          Retour aux examens
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-foreground/60" data-testid="mark-sheet-summary">
            {data.sheets.length} feuille{data.sheets.length > 1 ? "s" : ""} · {studentCount} élève
            {studentCount > 1 ? "s" : ""} · {pageCount} page{pageCount > 1 ? "s" : ""} A4
          </p>
          <PrintButton label="Imprimer" />
        </div>
      </div>

      {/* Sur téléphone, la feuille garde sa largeur A4 et défile. */}
      <div className="overflow-x-auto print:overflow-visible">
        {data.sheets.map((sheet) => (
          <SheetPages key={sheet.subject} data={data} sheet={sheet} />
        ))}
      </div>
    </div>
  );
}

function SheetPages({ data, sheet }: { data: MarkSheetsData; sheet: MarkSheet }) {
  const pages = paginateRows(sheet.rows.length, ROWS_PER_PAGE, ROWS_LAST_PAGE);
  // Largeurs des colonnes : le N°, le nom, les notes, l'observation.
  const numberW = 9;
  const observationW = 34;
  const noteW = Math.max(
    12,
    Math.min(20, (PAGE_WIDTH - numberW - 55 - observationW) / Math.max(sheet.columns.length, 1)),
  );

  return (
    <>
      {pages.map(([start, end], index) => (
        <section key={start} className={styles.page} data-testid="mark-sheet-page">
          <SchoolHead school={data.school} />

          <div className={styles.titleRow}>
            <div className={styles.title}>Feuille de notes</div>
            {pages.length > 1 && (
              <div className={styles.pageNumber}>
                Page {index + 1}/{pages.length}
              </div>
            )}
          </div>

          <div className={styles.info} data-testid="mark-sheet-info">
            <Info label="Classe" value={data.className} />
            <Info
              label="Matière"
              value={
                <>
                  {sheet.subject}
                  {sheet.subjectAr && (
                    <>
                      {" — "}
                      <bdi className={styles.arabic} lang="ar">
                        {sheet.subjectAr}
                      </bdi>
                    </>
                  )}
                  <span className={styles.pageNumber}> · coef. {sheet.coefficient}</span>
                </>
              }
            />
            <Info label="Trimestre" value={data.term} />
            <Info label="Année scolaire" value={data.yearLabel} />
            <Info label="Enseignant" value={sheet.teacher ?? <span className={styles.blank} />} />
            <Info label="Élèves" value={String(sheet.rows.length)} />
          </div>

          <table className={styles.table}>
            <colgroup>
              <col style={{ width: `${numberW}mm` }} />
              <col />
              {sheet.columns.map((c) => (
                <col key={c.key} style={{ width: `${noteW}mm` }} />
              ))}
              <col style={{ width: `${observationW}mm` }} />
            </colgroup>
            <thead>
              <tr>
                <th>N°</th>
                <th>Nom et prénom</th>
                {sheet.columns.map((c) => (
                  <th key={c.key} data-testid="mark-sheet-column">
                    {c.title}
                  </th>
                ))}
                <th>Observation</th>
              </tr>
            </thead>
            <tbody>
              {sheet.rows.slice(start, end).map((row) => (
                <tr key={row.number} data-testid="mark-sheet-row">
                  <td className={styles.number}>{String(row.number).padStart(2, "0")}</td>
                  <td className={styles.name}>
                    {row.name}
                    {row.rim && <span className={styles.rim}>RIM {row.rim}</span>}
                  </td>
                  {sheet.columns.map((c) => (
                    <td key={c.key} className={styles.cell}>
                      {row.cells[c.key] ?? ""}
                    </td>
                  ))}
                  <td />
                </tr>
              ))}
            </tbody>
          </table>

          {index === pages.length - 1 && (
            <>
              <div className={styles.footer} data-testid="mark-sheet-signature">
                <div>
                  Date de remise : <span className={styles.blank} />
                </div>
                <div>
                  Signature de l&apos;enseignant
                  <div className={styles.signature} />
                </div>
              </div>
              <p className={styles.hint}>
                Notes sur 20. Élève absent : écrire « abs ». Feuille à rendre à la direction.
              </p>
            </>
          )}
        </section>
      ))}
    </>
  );
}

function SchoolHead({ school }: { school: MarkSheetsData["school"] }) {
  if (school.logoIsLetterhead && school.logoUrl) {
    return (
      <div className={styles.school}>
        <Image src={school.logoUrl} alt="" width={1200} height={300} unoptimized className={styles.banner} />
      </div>
    );
  }
  const place = schoolPlaceLine(school);
  const phone = schoolPhoneLine(school);
  return (
    <div className={styles.school}>
      {school.logoUrl && (
        <Image src={school.logoUrl} alt="" width={400} height={400} unoptimized className={styles.logo} />
      )}
      <div>
        <div className={styles.schoolName}>{school.name}</div>
        {(place || phone) && (
          <div className={styles.schoolMeta}>{[place, phone && `Tél. ${phone}`].filter(Boolean).join(" · ")}</div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className={styles.infoLabel}>{label}</div>
      <div className={styles.infoValue}>{value}</div>
    </div>
  );
}
