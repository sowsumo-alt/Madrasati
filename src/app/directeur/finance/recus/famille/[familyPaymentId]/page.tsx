import Link from "next/link";
import { formatMoney, isAmountUnit, type AmountUnit } from "@/lib/money";
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
import { familyReceiptLines, studentReceiptLines } from "@/lib/receipt-lines";
import { CancelReceiptButton } from "../../cancel-receipt-button";
import { CancelledReceiptView } from "../../cancelled-receipt";
import { ReceiptDateButton } from "../../receipt-date-button";
import { familyReferentId } from "@/lib/family-sheet-data";

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
      parent: {
        include: {
          studentLinks: {
            orderBy: { student: { createdAt: "asc" } },
            select: {
              student: { select: { id: true, firstName: true, lastName: true, status: true, classRoom: { select: { name: true } } } },
            },
          },
        },
      },
      cancelledParts: { orderBy: { receiptNumber: "asc" } },
      payments: {
        include: {
          student: { select: { firstName: true, lastName: true, classRoom: { select: { name: true } } } },
          fee: {
            select: {
              label: true,
              amount: true,
              periodStart: true,
              periodEnd: true,
              familyParentId: true,
              payments: { select: { amount: true } },
            },
          },
        },
      },
    },
  });
  if (!familyPayment) notFound();

  const { t, locale } = await getTranslations();
  const { school, parent } = familyPayment;
  // Montants dans l'unité de l'école (MRO : la fiche papier, puis l'équivalent en MRU).
  const unit: AmountUnit = isAmountUnit(school.amountUnit) ? school.amountUnit : "MRU";
  const money = (amount: number) => formatMoney(amount, unit);
  const moneyAr = (amount: number) =>
    unit === "MRO" ? `${formatAmount(amount * 10)} أوقية قديمة (${formatAmount(amount)} أوقية جديدة)` : `${formatAmount(amount)} أوقية`;

  // Reçu annulé : ses lignes sont dans la trace des annulations.
  if (familyPayment.cancelledAt) {
    const cancelledName = parent ? familyLabel(parent, t("family.defaultName")) : t("family.receiptFamily");
    return (
      <CancelledReceiptView
        school={toSchoolIdentity(school)}
        unit={unit}
        title={t("family.receiptTitle")}
        receiptNumber={familyPayment.receiptNumber}
        paidAt={familyPayment.paidAt}
        parties={[
          { label: t("family.receiptFamily"), name: cancelledName },
          ...(parent ? [{ label: t("finance.parentOrGuardian"), name: `${parent.firstName} ${parent.lastName}` }] : []),
        ]}
        lines={familyPayment.cancelledParts.map((c) => ({
          label: c.studentName + (c.className ? ` — ${c.className}` : ""),
          detail: c.feeLabel,
          amount: c.amount,
        }))}
        total={familyPayment.total}
        method={t(`finance.method.${familyPayment.method}` as TranslationKey)}
        methodCode={familyPayment.method}
        cancelledAt={familyPayment.cancelledAt}
        reason={familyPayment.cancelReason ?? ""}
        cancelledBy={
          familyPayment.cancelledByUserId
            ? (await prisma.user.findUnique({ where: { id: familyPayment.cancelledByUserId }, select: { name: true } }))?.name
            : null
        }
        backHref={parent ? `/directeur/familles/${parent.id}` : "/directeur/finance"}
        backLabel={parent ? t("family.backToFamily") : t("finance.backToStudents")}
      />
    );
  }
  // Dans l'ordre des parts (REC-…-1, -2, …, -10), pas dans l'ordre alphabétique.
  const payments = [...familyPayment.payments].sort(
    (a, b) => partRank(a.receiptNumber) - partRank(b.receiptNumber),
  );
  const methodLabel = t(`finance.method.${familyPayment.method}` as TranslationKey);
  const name = parent ? familyLabel(parent, t("family.defaultName")) : t("family.receiptFamily");
  const parentName = parent ? `${parent.firstName} ${parent.lastName}` : null;

  // Un seul élève : un versement qui couvre plusieurs mois de sa formule
  // (« 4 mois d'un coup »). Le reçu est alors celui de l'élève — pas un reçu
  // « famille, 4 enfants ».
  const oneStudent = new Set(payments.map((p) => p.studentId)).size === 1 ? payments[0].student : null;
  // Lignes regroupées (les mois d'un enfant sur une ligne) : une ligne par
  // mois faisait déborder le reçu de sa demi-feuille.
  const parts = payments.map((p) => ({
    studentId: p.studentId,
    studentLabel: `${p.student.firstName} ${p.student.lastName}${p.student.classRoom ? ` — ${p.student.classRoom.name}` : ""}`,
    feeLabel: p.fee.label,
    amount: p.amount,
    periodStart: p.fee.periodStart,
    periodEnd: p.fee.periodEnd,
  }));
  const receiptLines = oneStudent ? studentReceiptLines(parts) : familyReceiptLines(parts);
  // Fiche de paiement familiale : les montants sont ceux de la famille, portés
  // par l'élève référent — comme la fiche papier, le reçu dit la famille, le
  // nombre d'élèves inscrits et le référent.
  const familySheet = Boolean(oneStudent && parent && payments.some((p) => p.fee.familyParentId));
  // Un reçu de famille : tous les enfants, chacun avec sa classe, et le même
  // élève référent que la page famille (familyReferentId).
  const familyReceipt = Boolean(parent && (familySheet || !oneStudent));
  const paidIds = new Set(payments.map((p) => p.studentId));
  const children = (parent?.studentLinks ?? [])
    .map((l) => l.student)
    .filter((s) => s.status === "ACTIVE" || paidIds.has(s.id));
  const enrolledCount = children.length;
  const referentId = parent && familyReceipt ? await familyReferentId(prisma, parent.id) : null;
  const childrenLine = children
    .map((s) => {
      const detail = [s.classRoom?.name, s.id === referentId ? "référent" : null].filter(Boolean).join(", ");
      return `${s.firstName} ${s.lastName}${detail ? ` (${detail})` : ""}`;
    })
    .join(" · ");

  // Ce qui reste sur les lignes de ce reçu : « Acompte » et le reste s'il y en
  // a un, sinon « Payé ».
  const remaining = payments.reduce((sum, p) => {
    const paid = p.fee.payments.reduce((s, x) => s + x.amount, 0);
    return sum + Math.max(p.fee.amount - paid, 0);
  }, 0);

  const bilingual = schoolHasFeature(school, FEATURES.BILINGUAL_MESSAGES);
  // Une famille : une ligne par enfant (inscription et juin additionnés),
  // dans l'ordre des parts.
  const perChild = new Map<string, { firstName: string; amount: number }>();
  for (const p of payments) {
    const entry = perChild.get(p.studentId) ?? { firstName: p.student.firstName, amount: 0 };
    entry.amount += p.amount;
    perChild.set(p.studentId, entry);
  }
  const lines = oneStudent
    ? receiptLines.map((l) => `- ${l.label}${l.detail ? ` (${l.detail})` : ""} : ${money(l.amount)}`)
    : [...perChild.values()].map((c) => `- ${c.firstName} : ${money(c.amount)}`);
  const linesAr = oneStudent
    ? receiptLines.map((l) => `- ${l.detail ?? l.label}: ${moneyAr(l.amount)}`)
    : [...perChild.values()].map((c) => `- ${c.firstName}: ${moneyAr(c.amount)}`);
  const forWhom = familySheet
    ? `votre famille (${enrolledCount} élèves inscrits)`
    : oneStudent
      ? `${oneStudent.firstName} ${oneStudent.lastName}`
      : "vos enfants";
  const forWhomAr = familySheet
    ? "لأسرتكم"
    : oneStudent
      ? `لـ ${oneStudent.firstName} ${oneStudent.lastName}`
      : "لأطفالكم";
  const confirmationMessage = parent
    ? withArabic(
        `Bonjour ${parentName},\n\nNous confirmons la réception d'un paiement de ${money(familyPayment.total)} pour ${forWhom}, effectué le ${formatLongDate(familyPayment.paidAt)} :\n${lines.join("\n")}\n\nReçu n° ${familyPayment.receiptNumber}. Merci pour votre règlement.\n\n${schoolSignatureFr(school.name)}`,
        bilingual
          ? `مرحبًا ${parentName}،\n\nنؤكد استلام دفعة بمبلغ ${unit === "MRO" ? moneyAr(familyPayment.total) : `${formatAmount(familyPayment.total)} أوقية موريتانية`} ${forWhomAr}، بتاريخ ${formatLongDateAr(familyPayment.paidAt)}:\n${linesAr.join("\n")}\n\nإيصال رقم ${familyPayment.receiptNumber}. شكرًا لتسديدكم.\n\n${schoolSignatureAr(school.name)}`
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
          <ReceiptDateButton
            target={{ familyPaymentId: familyPayment.id }}
            current={familyPayment.paidAt.toISOString().slice(0, 10)}
          />
          <PrintButton label={t("finance.printReceipt")} />
          <CancelReceiptButton
            target={{ familyPaymentId: familyPayment.id }}
            amountLabel={money(familyPayment.total)}
            family={payments.length > 1}
          />
        </div>
      </div>

      <ReceiptModeSwitch mode={mode} base={`/directeur/finance/recus/famille/${familyPayment.id}`} partnerName={null} />

      <ReceiptSheet
        mode={mode}
        top={
          <CompactReceipt
            id="recu-card"
            school={toSchoolIdentity(school)}
            title={oneStudent && !familySheet ? t("finance.receiptTitle") : t("family.receiptTitle")}
            receiptNumber={familyPayment.receiptNumber}
            date={formatDateIn(locale, familyPayment.paidAt, { day: "numeric", month: "long", year: "numeric" })}
            parties={[
              ...(familyReceipt
                ? [
                    { label: t("family.receiptFamily"), name, sub: `${enrolledCount} élève(s) inscrit(s)` },
                    { label: "Élèves", name: childrenLine },
                  ]
                : oneStudent
                  ? [
                      {
                        label: t("finance.student"),
                        name: `${oneStudent.firstName} ${oneStudent.lastName}`,
                        sub: oneStudent.classRoom?.name ?? t("students.noClass"),
                      },
                    ]
                  : [{ label: t("family.receiptFamily"), name, sub: t("family.childCount").replace("{count}", String(perChild.size)) }]),
              { label: t("finance.parentOrGuardian"), name: parentName ?? "—", sub: parent ? displayPhone(parent.phone) : null },
            ]}
            unit={unit}
            lines={receiptLines.map((l) => ({ label: l.label, detail: l.detail, amount: money(l.amount) }))}
            total={money(familyPayment.total)}
            paidAmount={familyPayment.total}
            methodCode={familyPayment.method}
            method={methodLabel}
            remaining={remaining > 0 ? t("finance.remainingIs").replace("{amount}", money(remaining)) : null}
            labels={{ paid: t("finance.paidAmount"), method: t("finance.method"), thanks: t("finance.thankYou") }}
          />
        }
        emptyHint="Bas de feuille libre."
      />
    </div>
  );
}
