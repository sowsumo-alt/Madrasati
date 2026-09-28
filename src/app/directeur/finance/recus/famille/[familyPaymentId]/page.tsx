import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
} from "@/lib/format";
import { PrintButton } from "@/components/ui/print-button";
import { PdfButton } from "@/components/ui/pdf-button";
import { CompactReceipt, ReceiptSheet, isReceiptPrintMode, type ReceiptPrintMode } from "@/components/receipts/compact-receipt";
import { ReceiptModeSwitch } from "@/components/receipts/receipt-mode-switch";
import { toSchoolIdentity } from "@/lib/official-header";
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
  searchParams,
}: {
  params: Promise<{ familyPaymentId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { familyPaymentId } = await params;
  const { mode: modeParam } = await searchParams;
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

  const mode: ReceiptPrintMode = isReceiptPrintMode(modeParam)
    ? modeParam
    : isReceiptPrintMode(school.receiptPrintMode)
      ? school.receiptPrintMode
      : "TWO_PER_PAGE";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
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

      <ReceiptModeSwitch mode={mode} base={`/directeur/finance/recus/famille/${familyPayment.id}`} partnerName={null} />

      <ReceiptSheet
        mode={mode}
        top={
          <CompactReceipt
            id="recu-card"
            school={toSchoolIdentity(school)}
            title={t("family.receiptTitle")}
            receiptNumber={familyPayment.receiptNumber}
            date={formatDateIn(locale, familyPayment.paidAt, { day: "numeric", month: "long", year: "numeric" })}
            parties={[
              { label: t("family.receiptFamily"), name, sub: t("family.childCount").replace("{count}", String(payments.length)) },
              { label: t("finance.parentOrGuardian"), name: parentName ?? "—", sub: parent ? displayPhone(parent.phone) : null },
            ]}
            lines={payments.map((p) => ({
              label: `${p.student.firstName} ${p.student.lastName}${p.student.classRoom ? ` — ${p.student.classRoom.name}` : ""}`,
              detail: p.fee.label,
              amount: formatMRU(p.amount),
            }))}
            total={formatMRU(familyPayment.total)}
            method={methodLabel}
            remaining={remaining > 0 ? t("finance.remainingIs").replace("{amount}", formatMRU(remaining)) : null}
            labels={{ paid: t("finance.paidAmount"), method: t("finance.method"), thanks: t("finance.thankYou") }}
          />
        }
        emptyHint="Bas de feuille libre."
      />
    </div>
  );
}
