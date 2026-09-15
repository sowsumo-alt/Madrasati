import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, GraduationCap, Info, Phone, UserRound, Users, Wallet } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { FEATURES, schoolHasFeature } from "@/lib/plans";
import { familyLabel } from "@/lib/family";
import {
  formatAmount,
  formatDateIn,
  formatLongDate,
  formatLongDateAr,
  formatMRU,
  formatPhone,
  ltrIsolate,
} from "@/lib/format";
import { PrintButton } from "@/components/ui/print-button";
import { PdfButton } from "@/components/ui/pdf-button";
import { PaymentMethodLogo } from "@/components/ui/payment-method-logo";
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";
import { buttonVariants } from "@/components/ui/button";
import { getTranslations } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { buildWhatsAppUrl, schoolSignatureAr, schoolSignatureFr, withArabic } from "@/lib/whatsapp";

/** « +22246523896 » ou « 22246523896 » -> « +222 46 52 38 96 ». */
function displayPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return formatPhone(`+${digits.length === 8 ? `222${digits}` : digits}`);
}

function partRank(receiptNumber: string) {
  return Number(receiptNumber.split("-")[3] ?? 0);
}

/**
 * Reçu d'un paiement familial : un seul reçu pour plusieurs enfants, avec le
 * montant de chacun et le total versé par la famille.
 */
export default async function FamilyReceiptPage({
  params,
}: {
  params: Promise<{ familyPaymentId: string }>;
}) {
  const { familyPaymentId } = await params;
  const user = await requireRole(ROLES.DIRECTOR);

  const familyPayment = await prisma.familyPayment.findFirst({
    where: { id: familyPaymentId, schoolId: user.schoolId },
    include: {
      school: true,
      parent: true,
      payments: {
        include: {
          student: { select: { firstName: true, lastName: true, classRoom: { select: { name: true } } } },
          fee: { select: { label: true, amount: true, payments: { select: { amount: true } } } },
        },
      },
    },
  });
  if (!familyPayment) notFound();

  const { t, locale } = await getTranslations();
  const { school, parent } = familyPayment;
  // Dans l'ordre des parts (REC-…-1, -2, …, -10), pas dans l'ordre alphabétique.
  const payments = [...familyPayment.payments].sort(
    (a, b) => partRank(a.receiptNumber) - partRank(b.receiptNumber),
  );
  const methodLabel = t(`finance.method.${familyPayment.method}` as TranslationKey);
  const name = parent ? familyLabel(parent, t("family.defaultName")) : t("family.receiptFamily");
  const parentName = parent ? `${parent.firstName} ${parent.lastName}` : null;

  // Reste dû après ce versement, frais par frais : un reçu qui n'annonce que
  // le montant reçu laisse croire au parent que tout est soldé.
  const remaining = payments.reduce((sum, p) => {
    const paid = p.fee.payments.reduce((s, x) => s + x.amount, 0);
    return sum + Math.max(p.fee.amount - paid, 0);
  }, 0);

  const bilingual = schoolHasFeature(school, FEATURES.BILINGUAL_MESSAGES);
  const lines = payments.map((p) => `- ${p.student.firstName} : ${formatAmount(p.amount)} MRU`);
  const linesAr = payments.map((p) => `- ${p.student.firstName}: ${formatAmount(p.amount)} أوقية`);
  const confirmationMessage = parent
    ? withArabic(
        `Bonjour ${parentName},\n\nNous confirmons la réception d'un paiement de ${formatAmount(familyPayment.total)} MRU pour vos enfants, effectué le ${formatLongDate(familyPayment.paidAt)} :\n${lines.join("\n")}\n\nReçu n° ${familyPayment.receiptNumber}. Merci pour votre règlement.\n\n${schoolSignatureFr(school.name)}`,
        bilingual
          ? `مرحبًا ${parentName}،\n\nنؤكد استلام دفعة بمبلغ ${formatAmount(familyPayment.total)} أوقية موريتانية لأطفالكم، بتاريخ ${formatLongDateAr(familyPayment.paidAt)}:\n${linesAr.join("\n")}\n\nإيصال رقم ${familyPayment.receiptNumber}. شكرًا لتسديدكم.\n\n${schoolSignatureAr(school.name)}`
          : null,
      )
    : "";

  const label = "text-xs font-semibold uppercase tracking-wider text-foreground/45";
  const th = "px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-primary-700";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={parent ? `/directeur/familles/${parent.id}` : "/directeur/finance"}
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground/55 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {parent ? t("family.backToFamily") : t("finance.backToStudents")}
        </Link>

        <div className="flex flex-wrap items-center gap-2 [&_a]:h-11 [&_button]:h-11">
          <PdfButton
            elementId="recu-card"
            fileName={`Recu-${familyPayment.receiptNumber}.pdf`}
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-50 text-primary-600">
              {school.logoUrl ? (
                <Image src={school.logoUrl} alt="" width={320} height={320} unoptimized className="h-full w-full object-cover" />
              ) : (
                <GraduationCap className="h-10 w-10" strokeWidth={1.75} />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-tight text-primary-900">{school.name}</p>
              {school.address && <p className="mt-0.5 text-sm text-primary-700/80">{school.address}</p>}
              {school.phone && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-primary-700">
                  <Phone className="h-4 w-4" />
                  <span dir="ltr">{formatPhone(school.phone)}</span>
                </p>
              )}
            </div>
          </div>

          <div className="sm:text-end">
            <span className="inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-700">
              {t("family.receiptTitle")}
            </span>
            <p className="mt-2 text-2xl font-bold text-foreground" style={{ fontVariantNumeric: "tabular-nums" }} dir="ltr">
              {familyPayment.receiptNumber}
            </p>
            <p className="mt-0.5 text-sm text-foreground/50">
              {formatDateIn(locale, familyPayment.paidAt, { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        </div>

        <div className="my-6 border-t border-border/70" />

        <div className="grid gap-6 sm:grid-cols-2 sm:divide-x sm:divide-border/70 rtl:sm:divide-x-reverse">
          <div className="sm:pe-6">
            <p className={`flex items-center gap-2 ${label}`}>
              <Users className="h-4 w-4 text-primary-600" />
              {t("family.receiptFamily")}
            </p>
            <p className="mt-1.5 text-lg font-bold text-foreground">{name}</p>
            <p className="text-sm text-foreground/55">
              {t("family.childCount").replace("{count}", String(payments.length))}
            </p>
          </div>
          <div className="sm:ps-6">
            <p className={`flex items-center gap-2 ${label}`}>
              <UserRound className="h-4 w-4 text-primary-600" />
              {t("finance.parentOrGuardian")}
            </p>
            <p className="mt-1.5 text-lg font-bold text-foreground">{parentName ?? "—"}</p>
            {parent && (
              <p className="flex items-center gap-1.5 text-sm text-foreground/55">
                <Phone className="h-3.5 w-3.5 text-primary-600" />
                <span dir="ltr">{displayPhone(parent.phone)}</span>
              </p>
            )}
          </div>
        </div>

        <section className="mt-6">
          <h2 className={label}>{t("family.receiptChildren")}</h2>
          <div className="mt-2 overflow-hidden rounded-xl border border-primary-200">
            <table className="w-full text-sm">
              <thead className="bg-primary-50/70">
                <tr>
                  <th className={th}>{t("finance.student")}</th>
                  <th className={`${th} hidden sm:table-cell`}>{t("students.class")}</th>
                  <th className={`${th} hidden sm:table-cell`}>{t("family.receiptFeeCol")}</th>
                  <th className={`${th} text-end`}>{t("finance.paidAmount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {payments.map((p) => (
                  <tr key={p.id} data-testid="receipt-line">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-foreground">
                        {p.student.firstName} {p.student.lastName}
                      </p>
                      <p className="text-xs text-foreground/50 sm:hidden">
                        {[p.student.classRoom?.name, p.fee.label].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td className="hidden px-3 py-3 text-foreground/70 sm:table-cell">
                      {p.student.classRoom?.name ?? t("students.noClass")}
                    </td>
                    <td className="hidden px-3 py-3 text-foreground/70 sm:table-cell">{p.fee.label}</td>
                    <td
                      className="whitespace-nowrap px-3 py-3 text-end font-semibold text-foreground"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      <span dir="ltr">{formatMRU(p.amount)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="text-sm text-foreground/60">{t("finance.method")}</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-sm font-medium text-foreground shadow-sm ring-1 ring-border/60">
              <PaymentMethodLogo method={familyPayment.method} className="h-4 w-4" />
              {methodLabel}
            </span>
          </div>
        </section>

        <div className="mt-6 border-t border-border/70 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-3 text-lg font-bold text-foreground">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <Wallet className="h-[18px] w-[18px]" />
              </span>
              {t("family.receiptTotal")}
            </p>
            <p
              data-testid="receipt-total"
              className="text-3xl font-bold text-primary-800"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              <span dir="ltr">{formatMRU(familyPayment.total)}</span>
            </p>
          </div>
          {remaining > 0 && (
            <p className="mt-2 text-end text-sm font-medium text-amber-700">
              {t("finance.remainingIs").replace("{amount}", ltrIsolate(formatMRU(remaining)))}
            </p>
          )}
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-xl bg-primary-50/60 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
          <div>
            <p className="text-sm font-semibold text-primary-900">{t("finance.thankYou")}</p>
            <p className="mt-0.5 text-sm text-foreground/60">{t("family.receiptPartsNote")}</p>
          </div>
        </div>

        <p data-pdf-show className="mt-6 hidden text-center text-xs text-foreground/40 print:block">
          {t("finance.receiptFooter")}
        </p>
      </div>
    </div>
  );
}
