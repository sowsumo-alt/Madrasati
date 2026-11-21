import { formatMRU } from "@/lib/format";
import { hoursLabel, payRates, type TeacherPay } from "@/lib/timesheet";

/** Le taux horaire d'une paie : un seul prix, ou une ligne par matière (« Physique : 1 300 MRU »). */
export function PayRates({ pay }: { pay: Pick<TeacherPay, "hourlyRate" | "parts"> }) {
  const rates = payRates(pay);
  return (
    <>
      {rates.map((r) => (
        <span key={r.subject} className="block whitespace-nowrap">
          {r.subject && `${r.subject} : `}
          {r.rate != null ? formatMRU(r.rate) : "—"}
        </span>
      ))}
    </>
  );
}

/** Le détail des honoraires quand plusieurs prix s'appliquent : « Physique 4 h × 1 300 MRU = 5 200 MRU ». */
export function PayParts({ pay, className }: { pay: Pick<TeacherPay, "parts">; className?: string }) {
  const parts = (pay.parts ?? []).filter((p) => p.minutes > 0);
  if (parts.length < 2) return null;
  return (
    <ul className={className} data-testid="pay-parts">
      {parts.map((p) => (
        <li key={`${p.subject}-${p.rate}`}>
          {p.subject || "Cours"} {hoursLabel(p.minutes)} × {p.rate != null ? formatMRU(p.rate) : "prix à renseigner"} = {formatMRU(p.amount)}
        </li>
      ))}
    </ul>
  );
}
