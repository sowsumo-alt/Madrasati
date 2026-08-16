"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, FileSignature, CalendarOff, Receipt } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { formatMRU, formatDate } from "@/lib/format";
import { ContractDialog } from "./contract-dialog";
import { LeaveDialog } from "./leave-dialog";
import { PayslipDialog } from "./payslip-dialog";

export interface TeacherHrRow {
  id: string;
  firstName: string;
  lastName: string;
  monthlySalary: number | null;
  contract: {
    type: string;
    startDate: string;
    endDate: string | null;
    leaveDaysPerYear: number;
    bonuses: { label: string; amount: number }[];
  } | null;
  leaveBalance: number;
  leaveDaysPerYear: number;
  leaves: {
    id: string;
    startDate: string;
    endDate: string;
    reason: string;
    note: string | null;
    days: number;
  }[];
}

const CONTRACT_LABELS: Record<string, string> = {
  CDI: "CDI",
  CDD: "CDD",
  VACATAIRE: "Vacataire",
};

const CONTRACT_VARIANT: Record<string, BadgeProps["variant"]> = {
  CDI: "success",
  CDD: "warning",
  VACATAIRE: "neutral",
};

export function RhView({
  teachers,
  schoolName,
  totalPayroll,
}: {
  teachers: TeacherHrRow[];
  schoolName: string;
  totalPayroll: number;
}) {
  const router = useRouter();
  const [contractTarget, setContractTarget] = useState<TeacherHrRow | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<TeacherHrRow | null>(null);
  const [payslipTarget, setPayslipTarget] = useState<TeacherHrRow | null>(null);

  function afterChange() {
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">RH &amp; Paie</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Contrats, congés et bulletins de salaire des enseignants.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile
          label="Masse salariale mensuelle"
          value={formatMRU(totalPayroll)}
          icon={Wallet}
          tone="accent"
          hint={`${teachers.length} enseignant(s) actif(s)`}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {teachers.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-foreground/50">
            Aucun enseignant actif pour l&apos;instant.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">Enseignant</th>
                  <th className="px-5 py-3">Contrat</th>
                  <th className="px-5 py-3">Salaire de base</th>
                  <th className="px-5 py-3">Primes</th>
                  <th className="px-5 py-3">Solde de congés</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teachers.map((t) => {
                  const bonusTotal = t.contract?.bonuses.reduce((s, b) => s + b.amount, 0) ?? 0;
                  return (
                    <tr key={t.id} className="hover:bg-surface-muted/40">
                      <td className="px-5 py-3 font-medium text-foreground">
                        {t.firstName} {t.lastName}
                      </td>
                      <td className="px-5 py-3">
                        {t.contract ? (
                          <div>
                            <Badge variant={CONTRACT_VARIANT[t.contract.type]}>
                              {CONTRACT_LABELS[t.contract.type]}
                            </Badge>
                            <p className="mt-1 text-xs text-foreground/40">
                              Depuis le {formatDate(t.contract.startDate)}
                              {t.contract.endDate && ` · jusqu'au ${formatDate(t.contract.endDate)}`}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-foreground/40">Aucun contrat</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {t.monthlySalary != null ? (
                          formatMRU(t.monthlySalary)
                        ) : (
                          <span className="text-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {bonusTotal > 0 ? (
                          formatMRU(bonusTotal)
                        ) : (
                          <span className="text-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={
                            t.leaveBalance < 0
                              ? "font-medium text-danger"
                              : "text-foreground/70"
                          }
                        >
                          {t.leaveBalance} / {t.leaveDaysPerYear} j
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="Contrat & primes"
                            onClick={() => setContractTarget(t)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                          >
                            <FileSignature className="h-4 w-4" />
                          </button>
                          <button
                            title="Congés"
                            onClick={() => setLeaveTarget(t)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                          >
                            <CalendarOff className="h-4 w-4" />
                          </button>
                          <button
                            title="Générer le bulletin de salaire"
                            onClick={() => setPayslipTarget(t)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-700 transition-colors hover:bg-primary-50"
                          >
                            <Receipt className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ContractDialog
        target={contractTarget}
        onOpenChange={(open) => !open && setContractTarget(null)}
        onSaved={afterChange}
      />
      <LeaveDialog
        target={leaveTarget}
        onOpenChange={(open) => !open && setLeaveTarget(null)}
        onSaved={afterChange}
      />
      <PayslipDialog
        target={payslipTarget}
        schoolName={schoolName}
        onOpenChange={(open) => !open && setPayslipTarget(null)}
      />
    </div>
  );
}
