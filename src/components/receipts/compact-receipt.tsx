import Image from "next/image";
import type { ReactNode } from "react";
import {
  schoolPhoneLine,
  schoolPlaceLine,
  type SchoolIdentity,
} from "@/lib/official-header";
import { amountInWords } from "@/lib/number-words";
import { PaymentMethodLogo } from "@/components/ui/payment-method-logo";
import styles from "./compact-receipt.module.css";

/**
 * Reçu de paiement au format demi-feuille (21 × 14,8 cm) : deux reçus
 * tiennent sur une feuille A4, ou un reçu sur une demi-feuille déjà coupée.
 *
 * Tout ce qu'un reçu professionnel porte : l'école, le numéro, la date, qui
 * paie et pour quel élève, le mode de paiement avec son logo, le détail, la
 * somme en chiffres et en lettres, le cachet « Payé » (ou « Acompte » s'il
 * reste un solde), la signature.
 */
export interface CompactReceiptProps {
  id?: string;
  school: SchoolIdentity;
  title: string;
  receiptNumber: string;
  date: string;
  /** Qui paie, pour qui : « Élève », « Reçu de »… */
  parties: { label: string; name: string; sub?: string | null }[];
  lines: { label: string; detail?: string | null; amount: string }[];
  total: string;
  /** Montant payé en MRU, écrit aussi en lettres. */
  paidAmount: number;
  /** Code du mode de paiement (logo) et son libellé. */
  methodCode: string;
  method: string;
  remaining?: string | null;
  /** Reçu annulé : tampon « ANNULÉ », date et motif ; l'argent n'est plus compté. */
  cancelled?: { date: string; reason: string; by?: string | null } | null;
  /** Libellés dans la langue de l'interface ; le français par défaut. */
  labels?: {
    paid?: string;
    method?: string;
    date?: string;
    thanks?: string;
    signature?: string;
    designation?: string;
    amount?: string;
  };
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
  paidAmount,
  methodCode,
  method,
  remaining,
  cancelled,
  labels = {},
}: CompactReceiptProps) {
  const place = schoolPlaceLine(school);
  const phone = schoolPhoneLine(school);
  // Un en-tête complet (bannière avec nom, logo, téléphone) se lit en grand,
  // centré en haut du reçu ; réduit dans un coin à côté du titre, il
  // devenait illisible.
  const letterhead = Boolean(school.logoIsLetterhead && school.logoUrl);

  return (
    <div id={id} className={styles.receipt} data-testid="compact-receipt">
      <div className={styles.frame}>
        <div className={letterhead ? styles.headLetterhead : styles.head}>
          <div className={letterhead ? styles.bannerWrap : styles.school}>
            {letterhead && school.logoUrl ? (
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
          <div className={letterhead ? styles.titleRow : styles.title}>
            <div className={styles.titleLabel}>{title}</div>
            <div className={styles.number} dir="ltr">
              N° {receiptNumber}
            </div>
          </div>
        </div>

        <div className={styles.info}>
          <div className="space-y-[2.2mm]">
            {parties.map((p) => (
              <div key={p.label}>
                <div className={styles.fieldLabel}>{p.label}</div>
                <div className={styles.fieldValue}>
                  {p.name}
                  {p.sub && (
                    <span className={styles.fieldSub} dir="auto">
                      {" "}· {p.sub}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-[2.2mm]">
            <div>
              <div className={styles.fieldLabel}>{labels.date ?? "Date"}</div>
              <div className={styles.fieldValue}>{date}</div>
            </div>
            <div>
              <div className={styles.fieldLabel}>{labels.method ?? "Mode de paiement"}</div>
              <div className={styles.methodChip} data-testid="receipt-method">
                <PaymentMethodLogo
                  method={methodCode}
                  className={styles.methodLogo}
                  fallback={<span className={styles.methodDot} aria-hidden />}
                />
                {method}
              </div>
            </div>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>{labels.designation ?? "Désignation"}</th>
              <th>{labels.amount ?? "Montant"}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>
                  <div className={styles.lineLabel}>{l.label}</div>
                  {l.detail && <div className={styles.lineDetail}>{l.detail}</div>}
                </td>
                <td className={styles.lineAmount}>{l.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className={styles.words} data-testid="amount-words">
          Arrêté le présent reçu à la somme de <b>{amountInWords(paidAmount)}</b>.
        </p>
        {cancelled && (
          <p className={styles.cancelNote} data-testid="receipt-cancelled">
            Reçu annulé le {cancelled.date}
            {cancelled.by ? ` par ${cancelled.by}` : ""} — motif : {cancelled.reason}. Ce montant n&apos;est plus compté
            comme perçu.
          </p>
        )}

        <div className={styles.bottom}>
          <div
            className={`${styles.stamp} ${cancelled ? styles.stampCancelled : remaining ? styles.stampPartial : styles.stampPaid}`}
            data-testid="receipt-stamp"
          >
            {cancelled ? "Annulé" : remaining ? "Acompte" : "Payé"}
          </div>
          <div className={styles.signature}>{labels.signature ?? "Signature et cachet de l'école"}</div>
          <div className={styles.totalBox}>
            <div className={styles.totalLabel}>{labels.paid ?? "Montant payé"}</div>
            <div className={styles.totalAmount}>{total}</div>
            {remaining && !cancelled && <div className={styles.remaining}>{remaining}</div>}
          </div>
        </div>

        <div className={styles.footer}>
          <span>{labels.thanks ?? "Merci pour votre confiance."} Reçu à conserver.</span>
          <span>Madrasati</span>
        </div>
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
