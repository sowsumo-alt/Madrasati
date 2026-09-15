"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  HandCoins,
  Link2,
  MapPin,
  Pencil,
  Phone,
  ReceiptText,
  UserPlus,
  UsersRound,
  Wallet,
  CircleCheck,
  CircleAlert,
  Banknote,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import { StudentAvatar } from "@/components/students/student-avatar";
import { PaymentMethodIcon } from "@/components/payments/payment-method-label";
import { formatDateIn, formatMRU, formatPhone } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { FamilyPaymentDialog } from "./family-payment-dialog";
import { AttachStudentDialog, CandidateRow, useAttach } from "./attach-student-dialog";
import { RenameFamilyDialog } from "./rename-family-dialog";
import type { FamilyPageData } from "./types";

function displayPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return formatPhone(`+${digits.length === 8 ? `222${digits}` : digits}`);
}

const KPI_TONES = {
  green: "bg-primary-50/80 text-primary-900 [&_svg]:text-primary-600",
  blue: "bg-sky-50 text-sky-950 [&_svg]:text-sky-600",
  emerald: "bg-emerald-50 text-emerald-950 [&_svg]:text-emerald-600",
  amber: "bg-amber-50 text-amber-950 [&_svg]:text-amber-600",
};

/** Fiche d'une famille : enfants, soldes, paiements et actions. */
export function FamilyView({ data }: { data: FamilyPageData }) {
  const { t, locale } = useLanguage();
  const [payOpen, setPayOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const suggestions = useAttach(data.parentId);

  const kpis = [
    { key: "children", label: t("family.kpiChildren"), value: String(data.children.length), icon: UsersRound, tone: "green" as const },
    { key: "billed", label: t("family.kpiBilled"), value: formatMRU(data.balance.billed), icon: ReceiptText, tone: "blue" as const },
    { key: "paid", label: t("family.kpiPaid"), value: formatMRU(data.balance.paid), icon: CircleCheck, tone: "emerald" as const },
    { key: "due", label: t("family.kpiDue"), value: formatMRU(data.balance.due), icon: CircleAlert, tone: "amber" as const },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <nav aria-label={t("nav.category.schooling")} className="mb-1.5 flex items-center gap-1.5 text-xs text-foreground/50">
            <Link href="/directeur/parents" className="hover:text-foreground">
              {t("nav.parents")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <span className="font-medium text-foreground/70">{data.label}</span>
          </nav>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <UsersRound className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
                <span className="truncate">{data.label}</span>
                <button
                  type="button"
                  onClick={() => setRenameOpen(true)}
                  title={t("family.rename")}
                  aria-label={t("family.rename")}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground/45 transition-colors hover:bg-surface-muted hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground/60">
                <span className="font-medium text-foreground/80">
                  {data.parent.firstName} {data.parent.lastName}
                  {data.parent.relationship && (
                    <span className="font-normal text-foreground/50"> ({data.parent.relationship})</span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5" dir="ltr">
                  <Phone className="h-3.5 w-3.5" />
                  {displayPhone(data.parent.phone)}
                </span>
                {data.parent.address && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {data.parent.address}
                  </span>
                )}
                <WhatsAppLink
                  phone={data.parent.phone}
                  message={`Bonjour ${data.parent.firstName},`}
                  title={t("parents.contactWhatsapp")}
                />
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setAttachOpen(true)}>
            <Link2 className="h-4 w-4" />
            {t("family.attachStudent")}
          </Button>
          <Link
            href={`/directeur/familles/inscription?famille=${data.parentId}`}
            className={buttonVariants({ variant: "secondary" })}
          >
            <UserPlus className="h-4 w-4" />
            {t("family.addChildren")}
          </Link>
          <Button onClick={() => setPayOpen(true)} disabled={data.openFees.length === 0} className="shadow-sm">
            <HandCoins className="h-4 w-4" />
            {t("family.payFamily")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map(({ key, label, value, icon: Icon, tone }) => (
          <div key={key} className={cn("flex min-w-0 items-center gap-3 rounded-2xl p-4", KPI_TONES[tone])}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface/70">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold" data-testid={`kpi-${key}`} style={{ fontVariantNumeric: "tabular-nums" }}>
                {value}
              </p>
              <p className="line-clamp-2 text-sm leading-snug opacity-70">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl border border-border/70 bg-surface/90 p-4 shadow-soft backdrop-blur-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-foreground">{t("family.childrenTitle")}</h2>
            <div className="flex gap-3 text-sm">
              <Link href={`/directeur/eleves?famille=${data.parentId}`} className="font-medium text-primary-700 hover:underline">
                {t("nav.students")}
              </Link>
              <Link href={`/directeur/finance?famille=${data.parentId}`} className="font-medium text-primary-700 hover:underline">
                {t("nav.payments")}
              </Link>
            </div>
          </div>
          {data.children.length === 0 ? (
            <p className="mt-4 rounded-xl bg-surface-muted/60 px-4 py-6 text-center text-sm text-foreground/55">
              {t("family.noChild")}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border/70">
              {data.children.map((c) => (
                <li key={c.id} data-testid="family-child" className="flex flex-wrap items-center gap-3 py-3">
                  <StudentAvatar firstName={c.firstName} lastName={c.lastName} photoUrl={c.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-foreground/55">
                      <span className="rounded-full bg-primary-50 px-2 py-0.5 font-semibold text-primary-700">
                        {c.className ?? t("students.noClass")}
                      </span>
                      {c.status !== "ACTIVE" && (
                        <span>{t(`students.status.${c.status}` as TranslationKey)}</span>
                      )}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-end text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                    <div>
                      <p className="text-foreground/50">{t("family.billed")}</p>
                      <p className="font-semibold text-foreground">{formatMRU(c.billed)}</p>
                    </div>
                    <div>
                      <p className="text-foreground/50">{t("family.paid")}</p>
                      <p className="font-semibold text-emerald-700">{formatMRU(c.paid)}</p>
                    </div>
                    <div>
                      <p className="text-foreground/50">{t("family.due")}</p>
                      <p className={cn("font-semibold", c.due > 0 ? "text-amber-700" : "text-foreground/45")}>
                        {c.due > 0 ? formatMRU(c.due) : t("family.upToDate")}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {data.suggestions.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="text-sm font-semibold text-amber-900">{t("family.suggestionsTitle")}</p>
              <p className="mt-0.5 text-xs text-amber-900/75">{t("family.suggestionsHint")}</p>
              <ul className="mt-2 divide-y divide-amber-200/70 rounded-lg bg-surface/80">
                {data.suggestions.map((s) => (
                  <CandidateRow
                    key={s.id}
                    candidate={s}
                    busy={suggestions.busyId === s.id}
                    onAttach={() => suggestions.attach(s.id)}
                  />
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-border/70 bg-surface/90 p-4 shadow-soft backdrop-blur-sm sm:p-5">
          <h2 className="text-lg font-bold text-foreground">{t("family.paymentsTitle")}</h2>
          {data.history.length === 0 ? (
            <p className="mt-4 rounded-xl bg-surface-muted/60 px-4 py-6 text-center text-sm text-foreground/55">
              {t("family.paymentsEmpty")}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.history.map((h) => (
                <li
                  key={`${h.kind}-${h.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3.5 py-3",
                    h.kind === "family" ? "border-primary-200 bg-primary-50/50" : "border-border/70",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      h.kind === "family" ? "bg-primary-700 text-white" : "bg-surface-muted text-foreground/60",
                    )}
                  >
                    {h.kind === "family" ? <Wallet className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {h.kind === "family" ? t("family.familyReceipt") : h.childName}
                    </p>
                    <p className="truncate text-xs text-foreground/55">
                      {h.kind === "family"
                        ? t("family.forChildren").replace("{names}", h.childNames.join(", "))
                        : h.feeLabel}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-foreground/45">
                      <span className="[&_img]:h-3.5 [&_img]:w-3.5 [&_svg]:h-3.5 [&_svg]:w-3.5">
                        <PaymentMethodIcon method={h.method} compact />
                      </span>
                      {formatDateIn(locale, h.paidAt, { day: "numeric", month: "short", year: "numeric" })}
                      <span dir="ltr">· {h.receiptNumber}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="font-bold text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatMRU(h.total)}
                    </p>
                    <Link
                      href={
                        h.kind === "family"
                          ? `/directeur/finance/recus/famille/${h.id}`
                          : `/directeur/finance/recus/${h.id}`
                      }
                      className="text-xs font-medium text-primary-700 hover:underline"
                    >
                      {t("family.viewReceipt")}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <FamilyPaymentDialog open={payOpen} onOpenChange={setPayOpen} parentId={data.parentId} fees={data.openFees} />
      <AttachStudentDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        parentId={data.parentId}
        candidates={data.candidates}
      />
      <RenameFamilyDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        parentId={data.parentId}
        current={data.familyName ?? ""}
      />
    </div>
  );
}
