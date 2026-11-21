import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { formatMRU } from "@/lib/format";
import { loadSchoolIdentity } from "@/lib/school-cache";
import { DocumentHeader } from "@/components/documents/document-header";
import { MonthSelect } from "@/components/timesheet/month-select";
import { PayParts, PayRates } from "@/components/timesheet/pay-rates";
import { ensureSessions, loadTimesheetSchool, monthPayroll, type PayLine } from "@/lib/timesheet-data";
import { dmy, effectiveStatus, hm, hoursLabel, monthKeyOf, monthLabelOf, monthRange, timesheetMonths } from "@/lib/timesheet";
import { TimesheetDisabled, TimesheetHeader } from "../timesheet-tabs";
import { SheetsToolbar } from "./sheets-toolbar";

interface SheetRow {
  id: string;
  date: string;
  time: string;
  className: string;
  presence: string;
  absence: string;
  observation: string;
}

const cell = "border border-black/70 px-1.5 py-1";

/**
 * Fiches de pointage du mois, au format de la fiche papier : une page par
 * enseignant (ou celle d'un seul), plus le récapitulatif de la masse
 * salariale. Imprimables et téléchargeables en un seul PDF.
 */
export default async function TimesheetSheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string; enseignant?: string; recap?: string }>;
}) {
  const user = await requireRole(ROLES.DIRECTOR);
  const school = await loadTimesheetSchool(user.schoolId);
  if (!school?.enabled) return <TimesheetDisabled />;

  const now = new Date();
  await ensureSessions(user.schoolId, now);
  const months = timesheetMonths(school.startDate, now);
  const params = await searchParams;
  const key = params.mois && months.includes(params.mois) ? params.mois : monthKeyOf(now);
  const range = monthRange(key)!;
  const recap = params.recap === "1";

  const [payroll, identity, sessions] = await Promise.all([
    monthPayroll(user.schoolId, key, now),
    loadSchoolIdentity(user.schoolId),
    prisma.teachingSession.findMany({
      where: { schoolId: user.schoolId, date: { gte: range.start, lt: range.end } },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        teacherId: true,
        replacementTeacherId: true,
        status: true,
        startsAt: true,
        endsAt: true,
        className: true,
        lateMinutes: true,
        observation: true,
        teacher: { select: { firstName: true, lastName: true } },
        replacementTeacher: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);
  const lines = payroll.lines.filter((l) => !params.enseignant || l.teacherId === params.enseignant);

  const rowsOf = (teacherId: string): SheetRow[] =>
    sessions
      .filter((s) => s.teacherId === teacherId || (s.status === "REPLACED" && s.replacementTeacherId === teacherId))
      .map((s) => {
        const status = effectiveStatus(s, now);
        const base = { id: s.id, date: dmy(s.startsAt), time: `${hm(s.startsAt)} – ${hm(s.endsAt)}`, observation: s.observation ?? "" };
        if (s.teacherId !== teacherId) {
          return { ...base, className: `${s.className} (pour ${s.teacher.firstName} ${s.teacher.lastName})`, presence: "Remplacement", absence: "" };
        }
        const replacement = s.replacementTeacher ? `${s.replacementTeacher.firstName} ${s.replacementTeacher.lastName}` : "";
        return {
          ...base,
          className: s.className,
          presence: status === "PRESENT" ? "Présent" : status === "LATE" ? `Retard ${s.lateMinutes} min` : "",
          absence:
            status === "ABSENT" ? "Absent" : status === "EXCUSED" ? "Absent justifié" : status === "REPLACED" ? `Remplacé par ${replacement}` : status === "PENDING" ? "À venir" : "",
        };
      });

  const title = recap ? `Récapitulatif — ${monthLabelOf(key)}` : `Fiches de pointage — ${monthLabelOf(key)}`;
  return (
    <div className="space-y-5">
      <TimesheetHeader current="fiches" title="Fiches de pointage" subtitle="Le format de la fiche papier, rempli tout seul. Une page par enseignant." />
      <div className="no-print flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft">
        <MonthSelect months={months} value={key} />
        <SheetsToolbar
          fileName={`${recap ? "Recapitulatif" : "Fiches-pointage"}-${key}${params.enseignant && lines[0] ? `-${lines[0].name.replace(/\s+/g, "-")}` : ""}.pdf`}
          month={key}
          recap={recap}
          count={recap ? 1 : lines.length}
        />
      </div>
      {payroll.locked ? (
        <p className="no-print text-sm text-emerald-800">Paie validée le {dmy(payroll.locked.at)} : montants figés.</p>
      ) : (
        <p className="no-print text-sm text-foreground/60">Paie pas encore validée : les montants suivent le pointage en direct.</p>
      )}

      {lines.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-foreground/60">Aucune séance ce mois-ci.</p>
      ) : recap ? (
        <Recap identity={identity} lines={lines} totals={payroll.totals} month={key} title={title} />
      ) : (
        lines.map((l) => <Sheet key={l.teacherId} identity={identity} line={l} rows={rowsOf(l.teacherId)} month={key} />)
      )}
    </div>
  );
}

function Sheet({ identity, line, rows, month }: { identity: Awaited<ReturnType<typeof loadSchoolIdentity>>; line: PayLine; rows: SheetRow[]; month: string }) {
  return (
    <article
      data-paper
      data-sheet
      className="mx-auto max-w-[210mm] bg-white p-8 text-[13px] text-black shadow-sm print:break-after-page print:p-0 print:shadow-none"
      data-testid="timesheet-sheet"
      data-teacher={line.name}
    >
      <DocumentHeader school={identity} />
      <h2 className="mt-4 text-center text-lg font-bold uppercase tracking-wide">Fiche de pointage</h2>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <p>
          <span className="font-semibold">Professeur :</span> {line.name}
        </p>
        <p>
          <span className="font-semibold">Discipline :</span> {line.subjects.join(", ") || "—"}
        </p>
        <p className="text-end">
          <span className="font-semibold">Mois :</span> {monthLabelOf(month)}
        </p>
      </div>
      <table className="mt-3 w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-black/5">
            {["Date", "Horaire", "Classe tenue", "Présence", "Absence", "Observations"].map((h) => (
              <th key={h} className={`${cell} text-start font-semibold uppercase`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-testid="sheet-row">
              <td className={`${cell} whitespace-nowrap`}>{r.date}</td>
              <td className={`${cell} whitespace-nowrap`}>{r.time}</td>
              <td className={cell}>{r.className}</td>
              <td className={cell}>{r.presence}</td>
              <td className={cell}>{r.absence}</td>
              <td className={cell}>{r.observation}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="mt-5 text-sm font-bold uppercase">Partie réservée à l&apos;administration</h3>
      <table className="mt-2 w-full border-collapse text-[12px]" data-testid="sheet-admin">
        <thead>
          <tr className="bg-black/5">
            {["Total heures", "Taux horaire", "Montant honoraires", "Déduction", "Net à payer"].map((h) => (
              <th key={h} className={`${cell} text-center font-semibold uppercase`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="text-center font-semibold">
            <td className={cell}>{hoursLabel(line.minutes)}</td>
            <td className={cell} data-testid="sheet-rate">
              <PayRates pay={line} />
            </td>
            <td className={cell}>{formatMRU(line.honoraires)}</td>
            <td className={cell}>{line.deductions > 0 ? formatMRU(line.deductions) : "—"}</td>
            <td className={cell} data-testid="sheet-net">
              {formatMRU(line.net)}
            </td>
          </tr>
        </tbody>
      </table>
      <PayParts pay={line} className="mt-1 text-[11px] text-black/70" />
      {line.deductions > 0 && (
        <p className="mt-1 text-[11px] text-black/70">
          Déduction : {[line.lateDeduction > 0 && `retards ${formatMRU(line.lateDeduction)} (${line.lateMinutes} min)`, line.advances > 0 && `avances ${formatMRU(line.advances)}`, line.otherDeductions > 0 && `autres ${formatMRU(line.otherDeductions)}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
        <div className="h-24 border-t border-black/60 pt-1">Signature de l&apos;enseignant</div>
        <div className="h-24 border-t border-black/60 pt-1 text-end">Signature et cachet de la direction</div>
      </div>
    </article>
  );
}

function Recap({
  identity,
  lines,
  totals,
  month,
  title,
}: {
  identity: Awaited<ReturnType<typeof loadSchoolIdentity>>;
  lines: PayLine[];
  totals: { minutes: number; honoraires: number; deductions: number; net: number };
  month: string;
  title: string;
}) {
  return (
    <article data-paper data-sheet className="mx-auto max-w-[210mm] bg-white p-8 text-[13px] text-black shadow-sm print:p-0 print:shadow-none" data-testid="timesheet-recap">
      <DocumentHeader school={identity} />
      <h2 className="mt-4 text-center text-lg font-bold uppercase tracking-wide">{title}</h2>
      <table className="mt-4 w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-black/5">
            {["Enseignant", "Heures", "Taux horaire", "Honoraires", "Déductions", "Net à payer"].map((h) => (
              <th key={h} className={`${cell} text-start font-semibold uppercase`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.teacherId}>
              <td className={cell}>{l.name}</td>
              <td className={`${cell} text-end`}>{hoursLabel(l.minutes)}</td>
              <td className={`${cell} text-end`}>
                <PayRates pay={l} />
              </td>
              <td className={`${cell} text-end`}>{formatMRU(l.honoraires)}</td>
              <td className={`${cell} text-end`}>{l.deductions > 0 ? formatMRU(l.deductions) : "—"}</td>
              <td className={`${cell} text-end font-semibold`}>{formatMRU(l.net)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td className={cell}>Masse salariale — {monthLabelOf(month)}</td>
            <td className={`${cell} text-end`}>{hoursLabel(totals.minutes)}</td>
            <td className={cell} />
            <td className={`${cell} text-end`}>{formatMRU(totals.honoraires)}</td>
            <td className={`${cell} text-end`}>{formatMRU(totals.deductions)}</td>
            <td className={`${cell} text-end`} data-testid="recap-total">
              {formatMRU(totals.net)}
            </td>
          </tr>
        </tfoot>
      </table>
      <div className="mt-10 text-end text-sm">
        <div className="ms-auto h-24 w-64 border-t border-black/60 pt-1">Signature et cachet de la direction</div>
      </div>
    </article>
  );
}
