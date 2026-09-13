"use client";

import { formatDate, formatMRU } from "@/lib/format";
import { isPaymentMethod } from "@/lib/payment-methods";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import type { FeeRow } from "../finance-view";
import { FEE_STATUS_KEYS } from "./fee-status-badge";

const cell = "border-b border-slate-200 px-2.5 py-2 align-top";
const tabular = { fontVariantNumeric: "tabular-nums" } as const;

/**
 * Version papier de la liste pour l'export PDF : en-tête de l'école, toutes
 * les lignes demandées — pas seulement la page affichée — et les totaux.
 * Rendue hors écran, le temps de la capture seulement.
 */
export function PaymentsReport({
  rows,
  schoolName,
  generatedOn,
}: {
  rows: FeeRow[];
  schoolName: string;
  generatedOn: string;
}) {
  const { t } = useLanguage();
  const totals = rows.reduce(
    (acc, r) => ({
      amount: acc.amount + r.amount,
      paid: acc.paid + r.totalPaid,
      remaining: acc.remaining + r.remaining,
    }),
    { amount: 0, paid: 0, remaining: 0 },
  );
  const headers = [
    t("finance.student"),
    t("students.class"),
    t("finance.colFeeType"),
    t("finance.amount"),
    t("finance.paidSoFar"),
    t("finance.remaining"),
    t("finance.colDate"),
    t("finance.status"),
    t("finance.method"),
  ];

  return (
    <div id="payments-report" className="bg-white p-10 text-[13px] text-slate-900" style={{ width: 1100 }}>
      <div className="flex items-end justify-between gap-6 border-b-2 border-emerald-700 pb-4">
        <div>
          <p className="text-2xl font-bold text-emerald-900">{schoolName}</p>
          <p className="mt-1 text-base font-semibold text-slate-600">{t("finance.reportTitle")}</p>
        </div>
        <p className="text-sm text-slate-500">{t("finance.reportGenerated").replace("{date}", generatedOn)}</p>
      </div>

      <table className="mt-5 w-full border-collapse">
        <thead>
          <tr className="bg-emerald-50 text-[11px] uppercase tracking-wide text-emerald-900">
            {headers.map((h) => (
              <th key={h} className="px-2.5 py-2 text-start font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const last = r.payments[r.payments.length - 1];
            return (
              <tr key={r.id}>
                <td className={cell}>
                  <span className="font-semibold">
                    {r.student.firstName} {r.student.lastName}
                  </span>
                </td>
                <td className={cell}>{r.student.className ?? "—"}</td>
                <td className={cell}>{r.label}</td>
                <td className={cell} style={tabular}>
                  {formatMRU(r.amount)}
                </td>
                <td className={cell} style={tabular}>
                  {formatMRU(r.totalPaid)}
                </td>
                <td className={cell} style={tabular}>
                  {formatMRU(r.remaining)}
                </td>
                <td className={cell} style={tabular}>
                  <span dir="ltr">{formatDate(last ? last.paidAt : r.dueDate)}</span>
                </td>
                <td className={cell}>{t(FEE_STATUS_KEYS[r.status])}</td>
                <td className={cell}>
                  {last && isPaymentMethod(last.method)
                    ? t(`finance.methodShort.${last.method}` as TranslationKey)
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-semibold">
            <td className="px-2.5 py-2.5" colSpan={3}>
              {t("finance.total")} ({rows.length})
            </td>
            <td className="px-2.5 py-2.5" style={tabular}>
              {formatMRU(totals.amount)}
            </td>
            <td className="px-2.5 py-2.5" style={tabular}>
              {formatMRU(totals.paid)}
            </td>
            <td className="px-2.5 py-2.5" style={tabular}>
              {formatMRU(totals.remaining)}
            </td>
            <td className="px-2.5 py-2.5" colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
