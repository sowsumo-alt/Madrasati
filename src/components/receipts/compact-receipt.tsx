import Image from "next/image";
import type { ReactNode } from "react";
import {
  schoolPhoneLine,
  schoolPlaceLine,
  type SchoolIdentity,
} from "@/lib/official-header";
import styles from "./compact-receipt.module.css";

/**
 * Reçu de paiement au format demi-feuille (21 × 14,8 cm) : deux reçus
 * tiennent sur une feuille A4, ou un reçu sur une demi-feuille déjà coupée.
 * Tout ce que le parent doit lire, rien de plus : l'école, le numéro et la
 * date, l'élève, ce qui est payé, le montant, le mode, la signature.
 */
export interface CompactReceiptProps {
  id?: string;
  school: SchoolIdentity;
  title: string;
  receiptNumber: string;
  date: string;
  parties: { label: string; name: string; sub?: string | null }[];
  lines: { label: string; detail?: string | null; amount: string }[];
  total: string;
  method: string;
  remaining?: string | null;
  /** Libellés dans la langue de l'interface ; le français par défaut. */
  labels?: { paid?: string; method?: string; thanks?: string; signature?: string };
}

export function CompactReceipt({
  id,
  school,
  title,
  receiptNumber,
  date,
  parties,
  lines,
  total,
  method,
  remaining,
  labels = {},
}: CompactReceiptProps) {
  const place = schoolPlaceLine(school);
  const phone = schoolPhoneLine(school);

  return (
    <div id={id} className={styles.receipt} data-testid="compact-receipt">
      <div className={styles.head}>
        <div className={styles.school}>
          {school.logoIsLetterhead && school.logoUrl ? (
            <Image src={school.logoUrl} alt="" width={1000} height={300} unoptimized className={styles.banner} />
          ) : (
            <>
              {school.logoUrl && (
                <Image src={school.logoUrl} alt="" width={400} height={400} unoptimized className={styles.logo} />
              )}
              <div className="min-w-0">
                <div className={styles.schoolName}>{school.name}</div>
                {(place || phone) && (
                  <div className={styles.schoolMeta}>
                    {[place, phone && `Tél. ${phone}`].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className={styles.title}>
          <div className={styles.titleLabel}>{title}</div>
          <div className={styles.number} dir="ltr">
            {receiptNumber}
          </div>
          <div className={styles.date}>{date}</div>
        </div>
      </div>

      <div className={styles.parties}>
        {parties.map((p) => (
          <div key={p.label}>
            <div className={styles.partyLabel}>{p.label}</div>
            <div className={styles.partyName}>{p.name}</div>
            {p.sub && (
              <div className={styles.partySub} dir="auto">
                {p.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.lines}>
        {lines.map((l, i) => (
          <div key={i} className={styles.line}>
            <div>
              <div className={styles.lineLabel}>{l.label}</div>
              {l.detail && <div className={styles.lineDetail}>{l.detail}</div>}
            </div>
            <div className={styles.lineAmount}>{l.amount}</div>
          </div>
        ))}
      </div>

      <div className={styles.total}>
        <div>
          <div className={styles.totalLabel}>{labels.paid ?? "Montant payé"}</div>
          <div className={styles.method}>
            {labels.method ?? "Mode de paiement"} : {method}
          </div>
        </div>
        <div className={styles.totalAmount}>{total}</div>
      </div>
      {remaining && <div className={styles.remaining}>{remaining}</div>}

      <div className={styles.footer}>
        <div className={styles.thanks}>{labels.thanks ?? "Merci pour votre confiance. Reçu à conserver."}</div>
        <div className={styles.signature}>{labels.signature ?? "Signature et cachet de l'école"}</div>
      </div>
    </div>
  );
}

export type ReceiptPrintMode = "TWO_PER_PAGE" | "HALF_SHEET";

export function isReceiptPrintMode(value: string | null | undefined): value is ReceiptPrintMode {
  return value === "TWO_PER_PAGE" || value === "HALF_SHEET";
}

/**
 * La feuille imprimée : deux reçus sur une A4 avec une ligne de coupe, ou un
 * reçu seul sur une demi-feuille (A5 couché). Le format de page est imposé
 * au navigateur, et la marge de l'application est retirée : le reçu porte
 * ses propres marges.
 */
export function ReceiptSheet({
  mode,
  top,
  bottom,
  emptyHint,
}: {
  mode: ReceiptPrintMode;
  top: ReactNode;
  bottom?: ReactNode;
  /** Texte de l'emplacement libre du bas, à l'écran seulement. */
  emptyHint?: string;
}) {
  const pageCss =
    mode === "HALF_SHEET"
      ? "@page { size: 210mm 148mm; margin: 0; }"
      : "@page { size: A4 portrait; margin: 0; }";

  return (
    <div className={styles.screenScroll}>
      <style>{`@media print { ${pageCss} main:has([data-receipt-sheet]) { padding: 0 !important; } }`}</style>
      <div
        className={`${styles.sheet} ${mode === "HALF_SHEET" ? styles.a5 : styles.a4}`}
        data-receipt-sheet={mode}
      >
        <div className={styles.slot}>{top}</div>
        {mode === "TWO_PER_PAGE" && (
          <>
            <div className={styles.cut} aria-hidden data-testid="cut-line">
              <span className={styles.scissors}>✂</span>
            </div>
            <div className={styles.slot} data-testid="bottom-slot">
              {bottom ?? <div className={styles.emptySlot}>{emptyHint}</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
