import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CompactReceipt, ReceiptSheet } from "@/components/receipts/compact-receipt";
import { PrintButton } from "@/components/ui/print-button";
import { formatDateIn, formatLongDate, formatMRU } from "@/lib/format";
import type { SchoolIdentity } from "@/lib/official-header";

/**
 * Reçu annulé : tel qu'il avait été remis, avec le tampon « ANNULÉ », la date
 * et le motif. Les lignes viennent de CancelledPayment, la trace conservée.
 */
export function CancelledReceiptView({
  school,
  title,
  receiptNumber,
  paidAt,
  parties,
  lines,
  total,
  method,
  methodCode,
  cancelledAt,
  reason,
  backHref,
  backLabel,
}: {
  school: SchoolIdentity;
  title: string;
  receiptNumber: string;
  paidAt: Date;
  parties: { label: string; name: string; sub?: string | null }[];
  lines: { label: string; detail?: string | null; amount: number }[];
  total: number;
  method: string;
  methodCode: string;
  cancelledAt: Date;
  reason: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground/55 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {backLabel}
        </Link>
        <PrintButton label="Imprimer le reçu annulé" />
      </div>
      <ReceiptSheet
        mode="HALF_SHEET"
        top={
          <CompactReceipt
            id="recu-card"
            school={school}
            title={title}
            receiptNumber={receiptNumber}
            date={formatDateIn("fr", paidAt, { day: "numeric", month: "long", year: "numeric" })}
            parties={parties}
            lines={lines.map((l) => ({ label: l.label, detail: l.detail, amount: formatMRU(l.amount) }))}
            total={formatMRU(total)}
            paidAmount={total}
            methodCode={methodCode}
            method={method}
            cancelled={{ date: formatLongDate(cancelledAt), reason }}
          />
        }
      />
    </div>
  );
}
