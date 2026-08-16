import { notFound } from "next/navigation";
import { requireFeature } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { FEATURES } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { formatMRU } from "@/lib/format";
import { PrintButton } from "@/components/ui/print-button";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export default async function PayslipPage({
  params,
}: {
  params: Promise<{ payslipId: string }>;
}) {
  const { payslipId } = await params;
  const user = await requireFeature(FEATURES.HR_PAYROLL, ROLES.DIRECTOR);

  const payslip = await prisma.payslip.findFirst({
    where: { id: payslipId, schoolId: user.schoolId },
    include: { teacher: true, school: true, bonusLines: true },
  });

  if (!payslip) notFound();

  const bonusTotal = payslip.bonusLines.reduce((sum, b) => sum + b.amount, 0);
  const grossPay = payslip.baseSalary + bonusTotal;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="no-print mb-6 flex justify-end">
        <PrintButton label="Imprimer" />
      </div>

      <div className="rounded-xl border border-border bg-surface p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="border-b border-border pb-6 text-center">
          <p className="text-base font-semibold text-primary-800">{payslip.school.name}</p>
          {payslip.school.address && (
            <p className="text-xs text-foreground/50">{payslip.school.address}</p>
          )}
          <p className="mt-3 text-sm font-medium uppercase tracking-wide text-foreground/60">
            Bulletin de salaire
          </p>
          <p className="text-sm text-foreground/50">
            {MONTHS[payslip.month - 1]} {payslip.year}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              Enseignant
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {payslip.teacher.firstName} {payslip.teacher.lastName}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              Généré le
            </p>
            <p className="mt-1 text-sm text-foreground/70">
              {payslip.generatedAt.toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-lg bg-surface-muted px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground/70">Salaire de base</span>
            <span className="font-medium text-foreground">
              {formatMRU(payslip.baseSalary)}
            </span>
          </div>
          {payslip.bonusLines.map((b) => (
            <div key={b.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground/70">{b.label}</span>
              <span className="font-medium text-foreground">{formatMRU(b.amount)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
            <span className="text-foreground/70">Salaire brut</span>
            <span className="font-medium text-foreground">{formatMRU(grossPay)}</span>
          </div>
          {payslip.deductions > 0 && (
            <div className="flex items-center justify-between text-sm text-danger">
              <span>
                Déductions{payslip.deductionNote ? ` (${payslip.deductionNote})` : ""}
              </span>
              <span className="font-medium">-{formatMRU(payslip.deductions)}</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
          <span className="text-sm font-semibold text-foreground">Net à payer</span>
          <span className="text-2xl font-semibold text-primary-800">
            {formatMRU(payslip.netPay)}
          </span>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-6 text-center text-xs text-foreground/50">
          <div>
            <div className="h-16 border-b border-border" />
            <p className="mt-2">Signature du directeur</p>
          </div>
          <div>
            <div className="h-16 border-b border-border" />
            <p className="mt-2">Signature de l&apos;enseignant</p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-foreground/40">
          Document généré par Madrasati — à conserver.
        </p>
      </div>
    </div>
  );
}
