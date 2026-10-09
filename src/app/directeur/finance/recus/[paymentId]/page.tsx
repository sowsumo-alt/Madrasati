import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { FEATURES, schoolHasFeature } from "@/lib/plans";
import { formatDateIn, formatLongDate, formatLongDateAr, formatAmount, formatPhone } from "@/lib/format";
import { PrintButton } from "@/components/ui/print-button";
import { toSchoolIdentity, type SchoolIdentity } from "@/lib/official-header";
import { formatMoney, isAmountUnit, type AmountUnit } from "@/lib/money";
import { PdfButton } from "@/components/ui/pdf-button";
import {
  CompactReceipt,
  ReceiptSheet,
  isReceiptPrintMode,
  type ReceiptPrintMode,
} from "@/components/receipts/compact-receipt";
import { ReceiptModeSwitch } from "@/components/receipts/receipt-mode-switch";
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";
import { buttonVariants } from "@/components/ui/button";
import { getTranslations } from "@/lib/i18n/server";
import type { Locale, TranslationKey } from "@/lib/i18n/dictionaries";
import {
  buildWhatsAppUrl,
  fillTemplate,
  withArabic,
  schoolSignatureFr,
  schoolSignatureAr,
} from "@/lib/whatsapp";
import { markReceiptsPrinted } from "../../actions";
import { CancelReceiptButton } from "../cancel-receipt-button";
import { CancelledReceiptView } from "../cancelled-receipt";
import { ReceiptDateButton } from "../receipt-date-button";

const DEFAULT_CONFIRMATION =
  "Bonjour {parentName},\n\nNous confirmons la réception d'un paiement de {amount} MRU pour {studentName}, effectué le {date}. Merci pour votre règlement.\n\n{schoolName}";
const DEFAULT_CONFIRMATION_AR =
  "مرحبًا {parentName}،\n\nنؤكد استلام دفعة بمبلغ {amount} أوقية موريتانية لـ {studentName}، بتاريخ {date}. شكرًا لتسديدكم.\n\n{schoolName}";

const RECEIPT_INCLUDE = {
  fee: { include: { payments: { select: { amount: true } } } },
  student: {
    include: {
      classRoom: { select: { name: true } },
      parentLinks: { where: { isPrimary: true }, include: { parent: true } },
    },
  },
} as const;

type ReceiptPayment = NonNullable<
  Awaited<ReturnType<typeof prisma.payment.findFirst<{ include: typeof RECEIPT_INCLUDE }>>>
>;

/** Nom du mode de paiement ; le code tel quel s'il n'a pas de traduction. */
function methodLabel(method: string, t: (key: TranslationKey) => string) {
  const key = `finance.method.${method}` as TranslationKey;
  const label = t(key);
  return label === key ? method : label;
}

/** Le reçu compact d'un paiement, dans la langue de l'interface. */
function receiptOf(
  payment: ReceiptPayment,
  school: SchoolIdentity,
  unit: AmountUnit,
  t: (key: TranslationKey) => string,
  locale: Locale,
  id?: string,
) {
  const parent = payment.student.parentLinks[0]?.parent ?? null;
  // Reste sur ce frais après ce versement : « Acompte » s'il y en a un, sinon « Payé ».
  const totalPaid = payment.fee.payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(payment.fee.amount - totalPaid, 0);
  // Les montants dans l'unité de l'école : une école en MRO retrouve sa fiche papier.
  const money = (amount: number) => formatMoney(amount, unit);
  return (
    <CompactReceipt
      unit={unit}
      id={id}
      school={school}
      title={t("finance.receiptTitle")}
      receiptNumber={payment.receiptNumber}
      date={formatDateIn(locale, payment.paidAt, { day: "numeric", month: "long", year: "numeric" })}
      parties={[
        {
          label: t("finance.student"),
          name: `${payment.student.firstName} ${payment.student.lastName}`,
          sub: payment.student.classRoom?.name ?? t("students.noClass"),
        },
        {
          label: t("finance.parentOrGuardian"),
          name: parent ? `${parent.firstName} ${parent.lastName}` : "—",
          sub: parent ? formatPhone(parent.phone) : null,
        },
      ]}
      lines={[
        {
          label: payment.fee.label,
          detail: payment.note?.trim() || null,
          amount: money(payment.fee.amount),
        },
      ]}
      total={money(payment.amount)}
      paidAmount={payment.amount}
      methodCode={payment.method}
      method={methodLabel(payment.method, t)}
      remaining={remaining > 0 ? t("finance.remainingIs").replace("{amount}", money(remaining)) : null}
      labels={{ paid: t("finance.paidAmount"), method: t("finance.method"), thanks: t("finance.thankYou") }}
    />
  );
}

/**
 * Reçu d'un paiement, au format demi-feuille. Deux façons d'imprimer, au
 * choix de l'école (Paramètres) et modifiables ici :
 * - « Pleine page » : deux reçus par feuille A4, à couper. Le reçu du jour
 *   pas encore imprimé prend le bas de la feuille ; une seule impression
 *   sort les deux.
 * - « À l'unité » : un reçu sur une demi-feuille déjà coupée (A5 couché).
 */
export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ mode?: string; seul?: string }>;
}) {
  const { paymentId } = await params;
  const { mode: modeParam, seul } = await searchParams;
  const user = await requireRole(ROLES.DIRECTOR);

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, schoolId: user.schoolId },
    include: { ...RECEIPT_INCLUDE, school: true },
  });

  if (!payment) {
    // Paiement annulé : son reçu reste lisible, marqué « ANNULÉ ».
    const cancelled = await prisma.cancelledPayment.findFirst({
      where: { id: paymentId, schoolId: user.schoolId },
      include: { school: true },
    });
    if (!cancelled) notFound();
    if (cancelled.familyPaymentId) redirect(`/directeur/finance/recus/famille/${cancelled.familyPaymentId}`);
    const { t } = await getTranslations();
    return (
      <CancelledReceiptView
        school={toSchoolIdentity(cancelled.school)}
        unit={isAmountUnit(cancelled.school.amountUnit) ? cancelled.school.amountUnit : "MRU"}
        title={t("finance.receiptTitle")}
        receiptNumber={cancelled.receiptNumber}
        paidAt={cancelled.paidAt}
        parties={[{ label: t("finance.student"), name: cancelled.studentName, sub: cancelled.className }]}
        lines={[{ label: cancelled.feeLabel, detail: cancelled.note, amount: cancelled.amount }]}
        total={cancelled.amount}
        method={methodLabel(cancelled.method, t)}
        methodCode={cancelled.method}
        cancelledAt={cancelled.cancelledAt}
        reason={cancelled.cancelReason}
        cancelledBy={
          cancelled.cancelledByUserId
            ? (await prisma.user.findUnique({ where: { id: cancelled.cancelledByUserId }, select: { name: true } }))?.name
            : null
        }
        backHref="/directeur/finance"
        backLabel="Retour aux paiements"
      />
    );
  }
  // Part d'un paiement familial : le parent a reçu un seul reçu pour tous ses
  // enfants, c'est celui-là qu'on montre.
  if (payment.familyPaymentId) redirect(`/directeur/finance/recus/famille/${payment.familyPaymentId}`);

  const mode: ReceiptPrintMode = isReceiptPrintMode(modeParam)
    ? modeParam
    : isReceiptPrintMode(payment.school.receiptPrintMode)
      ? payment.school.receiptPrintMode
      : "TWO_PER_PAGE";

  // Deux reçus par feuille : le bas reçoit un autre reçu du jour pas encore
  // imprimé — celui du paiement enregistré juste avant, sinon juste après.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const pending = {
    schoolId: user.schoolId,
    id: { not: payment.id },
    familyPaymentId: null,
    receiptPrintedAt: null,
  };
  const partner =
    mode === "TWO_PER_PAGE" && seul !== "1"
      ? ((await prisma.payment.findFirst({
          where: { ...pending, paidAt: { gte: startOfDay, lte: payment.paidAt } },
          orderBy: { paidAt: "desc" },
          include: RECEIPT_INCLUDE,
        })) ??
        (await prisma.payment.findFirst({
          where: { ...pending, paidAt: { gt: payment.paidAt } },
          orderBy: { paidAt: "asc" },
          include: RECEIPT_INCLUDE,
        })))
      : null;

  const parent = payment.student.parentLinks[0]?.parent ?? null;
  const { t, locale } = await getTranslations();
  const school = toSchoolIdentity(payment.school);
  const unit: AmountUnit = isAmountUnit(payment.school.amountUnit) ? payment.school.amountUnit : "MRU";

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

  const printedIds = partner ? [payment.id, partner.id] : [payment.id];
  const base = `/directeur/finance/recus/${payment.id}`;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Le reçu s'ouvre juste après une inscription : sans ce retour, le
          directeur se retrouve sur une page sans issue vers sa liste. */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
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
          <ReceiptDateButton target={{ paymentId: payment.id }} current={payment.paidAt.toISOString().slice(0, 10)} />
          <PrintButton
            label={partner ? "Imprimer les 2 reçus" : t("finance.printReceipt")}
            onUse={markReceiptsPrinted.bind(null, printedIds)}
          />
          <CancelReceiptButton target={{ paymentId: payment.id }} amountLabel={formatMoney(payment.amount, unit)} />
        </div>
      </div>

      <ReceiptModeSwitch
        mode={mode}
        base={base}
        partnerName={partner ? `${partner.student.firstName} ${partner.student.lastName}` : null}
      />

      <ReceiptSheet
        mode={mode}
        top={receiptOf(payment, school, unit, t, locale, "recu-card")}
        bottom={partner ? receiptOf(partner, school, unit, t, locale) : undefined}
        emptyHint="Bas de feuille libre : le prochain reçu du jour s'y placera. Vous pouvez aussi imprimer maintenant."
      />
    </div>
  );
}
