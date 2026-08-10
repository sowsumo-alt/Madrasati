import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { formatMRU, formatDate } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/roles";
import { PrintButton } from "@/components/ui/print-button";
import { GraduationCap } from "lucide-react";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const user = await requireRole(ROLES.DIRECTOR);

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, schoolId: user.schoolId },
    include: {
      fee: true,
      student: {
        include: {
          classRoom: { select: { name: true } },
          parentLinks: { where: { isPrimary: true }, include: { parent: true } },
        },
      },
      school: true,
    },
  });

  if (!payment) notFound();

  const parent = payment.student.parentLinks[0]?.parent ?? null;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="no-print mb-6 flex justify-end">
        <PrintButton label="Imprimer le reçu" />
      </div>

      <div className="rounded-xl border border-border bg-surface p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-border pb-6">
          <div className="flex items-center gap-2 text-primary-800">
            <GraduationCap className="h-7 w-7" strokeWidth={2} />
            <div>
              <p className="text-base font-semibold leading-tight">
                {payment.school.name}
              </p>
              {payment.school.address && (
                <p className="text-xs text-foreground/50">
                  {payment.school.address}
                </p>
              )}
              {payment.school.phone && (
                <p className="text-xs text-foreground/50">
                  {payment.school.phone}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              Reçu de paiement
            </p>
            <p className="text-sm font-semibold text-foreground">
              {payment.receiptNumber}
            </p>
            <p className="text-xs text-foreground/50">
              {formatDate(payment.paidAt)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              Élève
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {payment.student.firstName} {payment.student.lastName}
            </p>
            <p className="text-xs text-foreground/50">
              {payment.student.classRoom?.name ?? "Sans classe"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              Parent / tuteur
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {parent ? `${parent.firstName} ${parent.lastName}` : "—"}
            </p>
            {parent && (
              <p className="text-xs text-foreground/50">{parent.phone}</p>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-surface-muted px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground/70">{payment.fee.label}</span>
            <span className="font-medium text-foreground">
              {formatMRU(payment.amount)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-foreground/50">
            <span>Mode de paiement</span>
            <span>{PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}</span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-6">
          <span className="text-sm font-semibold text-foreground">
            Montant payé
          </span>
          <span className="text-xl font-semibold text-primary-800">
            {formatMRU(payment.amount)}
          </span>
        </div>

        <p className="mt-8 text-center text-xs text-foreground/40">
          Reçu généré par Madrasati — merci de votre confiance.
        </p>
      </div>
    </div>
  );
}
