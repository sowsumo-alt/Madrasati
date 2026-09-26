import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Info,
  Phone,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { FEATURES, schoolHasFeature } from "@/lib/plans";
import {
  formatMRU,
  formatDateIn,
  formatLongDate,
  formatLongDateAr,
  formatAmount,
  formatPhone,
} from "@/lib/format";
import { PrintButton } from "@/components/ui/print-button";
import { DocumentHeader } from "@/components/documents/document-header";
import { toSchoolIdentity } from "@/lib/official-header";
import { PdfButton } from "@/components/ui/pdf-button";
import { PaymentMethodLogo } from "@/components/ui/payment-method-logo";
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";
import { buttonVariants } from "@/components/ui/button";
import { getTranslations } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import {
  buildWhatsAppUrl,
  fillTemplate,
  withArabic,
  schoolSignatureFr,
  schoolSignatureAr,
} from "@/lib/whatsapp";

const DEFAULT_CONFIRMATION =
  "Bonjour {parentName},\n\nNous confirmons la réception d'un paiement de {amount} MRU pour {studentName}, effectué le {date}. Merci pour votre règlement.\n\n{schoolName}";
const DEFAULT_CONFIRMATION_AR =
  "مرحبًا {parentName}،\n\nنؤكد استلام دفعة بمبلغ {amount} أوقية موريتانية لـ {studentName}، بتاريخ {date}. شكرًا لتسديدكم.\n\n{schoolName}";

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
      fee: { include: { payments: { select: { amount: true } } } },
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
  // Part d'un paiement familial : le parent a reçu un seul reçu pour tous ses
  // enfants, c'est celui-là qu'on montre.
  if (payment.familyPaymentId) redirect(`/directeur/finance/recus/famille/${payment.familyPaymentId}`);

  const parent = payment.student.parentLinks[0]?.parent ?? null;
  const { t, locale } = await getTranslations();
  const methodLabel = t(`finance.method.${payment.method}` as TranslationKey);

  // Reste dû après ce versement : un reçu qui n'annonce que le montant reçu
  // laisse croire au parent que tout est soldé.
  const totalPaid = payment.fee.payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(payment.fee.amount - totalPaid, 0);

  const confirmationTemplate = await prisma.messageTemplate.findFirst({
    where: { schoolId: user.schoolId, key: "PAYMENT_CONFIRMATION" },
    select: { body: true, bodyAr: true },
  });

  const bilingual = schoolHasFeature(payment.school, FEATURES.BILINGUAL_MESSAGES);

  const confirmationMessage = parent
    ? withArabic(
        fillTemplate(confirmationTemplate?.body ?? DEFAULT_CONFIRMATION, {
          parentName: `${parent.firstName} ${parent.lastName}`,
          studentName: `${payment.student.firstName} ${payment.student.lastName}`,
          amount: formatAmount(payment.amount),
          date: formatLongDate(payment.paidAt),
          schoolName: schoolSignatureFr(payment.school.name),
        }),
        bilingual
          ? fillTemplate(confirmationTemplate?.bodyAr ?? DEFAULT_CONFIRMATION_AR, {
              parentName: `${parent.firstName} ${parent.lastName}`,
              studentName: `${payment.student.firstName} ${payment.student.lastName}`,
              amount: formatAmount(payment.amount),
              date: formatLongDateAr(payment.paidAt),
              schoolName: schoolSignatureAr(payment.school.name),
            })
          : null,
      )
    : "";

  const label = "text-xs font-semibold uppercase tracking-wider text-foreground/45";

  return (
    <div className="mx-auto max-w-5xl">
      {/* Le reçu s'ouvre juste après une inscription : sans ce retour, le
          directeur se retrouve sur une page sans issue vers sa liste. */}
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/directeur/eleves"
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground/55 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t("finance.backToStudents")}
        </Link>

        <div className="flex flex-wrap items-center gap-2 [&_a]:h-11 [&_button]:h-11">
          <PdfButton
            elementId="recu-card"
            fileName={`Recu-${payment.receiptNumber}.pdf`}
            labelKey={parent ? "finance.sendReceiptPdf" : "finance.downloadReceiptPdf"}
            parentPhone={parent?.phone ?? null}
            message={confirmationMessage}
          />
          {parent && (
            <a
              href={buildWhatsAppUrl(parent.phone, confirmationMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "secondary" })}
            >
              <WhatsAppIcon className="h-4 w-4 text-emerald-600" />
              {t("finance.confirmOnWhatsApp")}
            </a>
          )}
          <PrintButton label={t("finance.printReceipt")} />
        </div>
      </div>

      <div
        id="recu-card"
        className="mx-auto max-w-3xl rounded-2xl border border-border/80 bg-surface p-6 shadow-soft sm:p-8 print:max-w-none print:border-0 print:shadow-none"
      >
        <DocumentHeader school={toSchoolIdentity(payment.school)} />

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-700">
              {t("finance.receiptTitle")}
            </span>
            <p
              className="mt-2 text-2xl font-bold text-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
              dir="ltr"
            >
              {payment.receiptNumber}
            </p>
          </div>
          <p className="text-sm text-foreground/50">{formatDateIn(locale, payment.paidAt, { day: "numeric", month: "short", year: "numeric" })}</p>
        </div>

        <div className="my-6 border-t border-border/70" />

        <div className="grid gap-6 sm:grid-cols-2 sm:divide-x sm:divide-border/70 rtl:sm:divide-x-reverse">
          <div className="sm:pe-6">
            <p className={`flex items-center gap-2 ${label}`}>
              <Users className="h-4 w-4 text-primary-600" />
              {t("finance.student")}
            </p>
            <p className="mt-1.5 text-lg font-bold text-foreground">
              {payment.student.firstName} {payment.student.lastName}
            </p>
            <p className="text-sm text-foreground/55">
              {payment.student.classRoom?.name ?? t("students.noClass")}
            </p>
          </div>
          <div className="sm:ps-6">
            <p className={`flex items-center gap-2 ${label}`}>
              <UserRound className="h-4 w-4 text-primary-600" />
              {t("finance.parentOrGuardian")}
            </p>
            <p className="mt-1.5 text-lg font-bold text-foreground">
              {parent ? `${parent.firstName} ${parent.lastName}` : "—"}
            </p>
            {parent && (
              <p className="flex items-center gap-1.5 text-sm text-foreground/55">
                <Phone className="h-3.5 w-3.5 text-primary-600" />
                <span dir="ltr">{formatPhone(parent.phone)}</span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-primary-50/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-primary-600 shadow-sm">
                <CalendarDays className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{payment.fee.label}</p>
                <p className="mt-0.5 text-sm text-foreground/55">
                  {payment.note?.trim() || t("finance.noPaymentNote")}
                </p>
              </div>
            </div>
            <p
              className="whitespace-nowrap text-xl font-bold text-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatMRU(payment.fee.amount)}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="text-sm text-foreground/60">{t("finance.method")}</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-sm font-medium text-foreground shadow-sm">
              <PaymentMethodLogo method={payment.method} className="h-4 w-4" />
              {methodLabel}
            </span>
          </div>
        </div>

        <div className="mt-6 border-t border-border/70 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-3 text-lg font-bold text-foreground">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <Wallet className="h-[18px] w-[18px]" />
              </span>
              {t("finance.paidAmount")}
            </p>
            <p
              className="text-3xl font-bold text-primary-800"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatMRU(payment.amount)}
            </p>
          </div>

          {/* Versement partiel : le reste dû est écrit, pour qu'un reçu ne
              passe jamais pour un solde de tout compte. */}
          {remaining > 0 && (
            <p className="mt-2 text-end text-sm font-medium text-amber-700">
              {t("finance.remainingIs").replace("{amount}", formatMRU(remaining))}
            </p>
          )}
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-xl bg-primary-50/60 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
          <div>
            <p className="text-sm font-semibold text-primary-900">{t("finance.thankYou")}</p>
            <p className="mt-0.5 text-sm text-foreground/60">{t("finance.receiptSuccess")}</p>
          </div>
        </div>

        <p data-pdf-show className="mt-6 hidden text-center text-xs text-foreground/40 print:block">
          {t("finance.receiptFooter")}
        </p>
      </div>
    </div>
  );
}
