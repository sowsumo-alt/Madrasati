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
import { useLanguage } from "@/lib/i18n/language-provider";

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
  const { t } = useLanguage();
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
        <p className="mt-1 text-sm text-foreground/60">{t("hr.subtitle")}</p>
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
          <div className="px-5 py-16 text-center text-sm text-foreground/50">{t("hr.noTeacher")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">Enseignant</th>
                  <th className="px-5 py-3">Contrat</th>
                  <th className="px-5 py-3">Salaire de base</th>
                  <th className="px-5 py-3">Primes</th>
                  <th className="px-5 py-3">{t("hr.leaveBalance")}</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teachers.map((teacher) => {
                  const bonusTotal = teacher.contract?.bonuses.reduce((s, b) => s + b.amount, 0) ?? 0;
                  return (
                    <tr key={teacher.id} className="hover:bg-surface-muted/40">
                      <td className="px-5 py-3 font-medium text-foreground">
                        {teacher.firstName} {teacher.lastName}
                      </td>
                      <td className="px-5 py-3">
                        {teacher.contract ? (
                          <div>
                            <Badge variant={CONTRACT_VARIANT[teacher.contract.type]}>
                              {CONTRACT_LABELS[teacher.contract.type]}
                            </Badge>
                            <p className="mt-1 text-xs text-foreground/40">
                              Depuis le {formatDate(teacher.contract.startDate)}
                              {teacher.contract.endDate && ` · jusqu'au ${formatDate(teacher.contract.endDate)}`}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-foreground/40">{t("hr.noContract")}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {teacher.monthlySalary != null ? (
                          formatMRU(teacher.monthlySalary)
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
                            teacher.leaveBalance < 0
                              ? "font-medium text-danger"
                              : "text-foreground/70"
                          }
                        >
                          {teacher.leaveBalance} / {teacher.leaveDaysPerYear} j
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="Contrat & primes"
                            onClick={() => setContractTarget(teacher)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                          >
                            <FileSignature className="h-4 w-4" />
                          </button>
                          <button
                            title={t("hr.leaves")}
                            onClick={() => setLeaveTarget(teacher)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                          >
                            <CalendarOff className="h-4 w-4" />
                          </button>
                          <button
                            title={t("hr.generatePayslip")}
                            onClick={() => setPayslipTarget(teacher)}
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
