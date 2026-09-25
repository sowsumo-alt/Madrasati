"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import {
  Banknote,
  Eye,
  MessageCircle,
  MoreVertical,
  Pencil,
  Receipt,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StudentAvatar } from "@/components/students/student-avatar";
import { PaymentMethodLabel } from "@/components/payments/payment-method-label";
import { formatDate, formatMRU } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { FeeRow } from "../finance-view";
import { FeeStatusBadge, overdueText } from "./fee-status-badge";
import { parentLine } from "./parent-line";
import { FamilyBadge } from "@/components/family/family-badge";

export interface FeeRowActions {
  onView: (fee: FeeRow) => void;
  onEdit: (fee: FeeRow) => void;
  onRecordPayment: (fee: FeeRow) => void;
  onDelete: (fee: FeeRow) => void;
  /** Lien WhatsApp de relance ; `null` pour un frais soldé ou sans parent joignable. */
  reminderUrl: (fee: FeeRow) => string | null;
  /** Filtre la liste sur la famille de ce parent. */
  onFamily: (parentId: string) => void;
}

const checkboxClass = "h-4 w-4 cursor-pointer rounded border-border accent-primary-700";
const classChip =
  "inline-flex whitespace-nowrap rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700";
const tabular = { fontVariantNumeric: "tabular-nums" } as const;

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/55 transition-colors hover:bg-surface-muted hover:text-primary-700"
    >
      {children}
    </button>
  );
}

/**
 * Menu « ⋮ » d'un frais. Au niveau du module et non dans le tableau : un
 * composant déclaré à l'intérieur d'un autre est remonté à chaque rendu, et un
 * menu ouvert se refermerait aussitôt.
 *
 * La suppression n'apparaît que tant qu'aucun paiement n'est rattaché : ses
 * reçus partiraient avec le frais (voir deleteFee).
 */
function RowMenu({ fee, actions }: { fee: FeeRow; actions: FeeRowActions }) {
  const { t } = useLanguage();
  const reminder = actions.reminderUrl(fee);
  const lastPayment = fee.payments[fee.payments.length - 1];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("common.actions")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/55 transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[14rem]">
        {fee.remaining > 0 && (
          <DropdownMenuItem onClick={() => actions.onRecordPayment(fee)}>
            <Banknote className="h-4 w-4 text-primary-600" />
            {t("finance.recordPayment")}
          </DropdownMenuItem>
        )}
        {reminder && (
          <DropdownMenuItem asChild>
            <a href={reminder} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              {t("finance.sendReminder")}
            </a>
          </DropdownMenuItem>
        )}
        {lastPayment && (
          <DropdownMenuItem asChild>
            <Link href={`/directeur/finance/recus/${lastPayment.id}`} target="_blank">
              <Receipt className="h-4 w-4 text-foreground/60" />
              {t("finance.viewReceipt")}
            </Link>
          </DropdownMenuItem>
        )}
        {fee.payments.length === 0 && (
          <DropdownMenuItem onClick={() => actions.onDelete(fee)} className="text-danger">
            <Trash2 className="h-4 w-4" />
            {t("finance.deleteFee")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Date du dernier paiement, ou échéance annoncée comme telle pour un frais sans
 * versement. `stacked` pose « Échéance » au-dessus de la date, pour une colonne étroite.
 */
function FeeDate({ fee, stacked = false }: { fee: FeeRow; stacked?: boolean }) {
  const { t } = useLanguage();
  const last = fee.payments[fee.payments.length - 1];
  if (last) {
    return (
      <span dir="ltr" className="whitespace-nowrap" style={tabular}>
        {formatDate(last.paidAt)}
      </span>
    );
  }
  return (
    <span className={stacked ? "block" : "whitespace-nowrap"}>
      <span className={cn("text-foreground/45", stacked && "block text-[11px] uppercase tracking-wide")}>
        {t("finance.dueOn")}
        {stacked ? "" : " "}
      </span>
      <span dir="ltr" className="whitespace-nowrap" style={tabular}>
        {formatDate(fee.dueDate)}
      </span>
    </span>
  );
}

function RowButtons({ fee, actions }: { fee: FeeRow; actions: FeeRowActions }) {
  const { t } = useLanguage();
  return (
    <div className="flex shrink-0 items-center justify-end gap-0.5">
      <IconButton label={t("finance.viewDetails")} onClick={() => actions.onView(fee)}>
        <Eye className="h-4 w-4" />
      </IconButton>
      <IconButton label={t("common.edit")} onClick={() => actions.onEdit(fee)}>
        <Pencil className="h-4 w-4" />
      </IconButton>
      <RowMenu fee={fee} actions={actions} />
    </div>
  );
}

/**
 * Une page de frais : tableau à partir de la tablette, cartes sur téléphone.
 * Les colonnes secondaires (classe, type, date, mode) n'apparaissent que
 * lorsque la largeur le permet ; en deçà, leur information passe sous une
 * autre colonne plutôt que de disparaître.
 */
export function PaymentsTable({
  rows,
  selected,
  onToggleRow,
  onTogglePage,
  actions,
}: {
  rows: FeeRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onTogglePage: (checked: boolean) => void;
  actions: FeeRowActions;
}) {
  const { t } = useLanguage();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const checkedOnPage = rows.filter((r) => selected.has(r.id)).length;
  const allChecked = rows.length > 0 && checkedOnPage === rows.length;

  // État intermédiaire de la case d'en-tête quand une partie de la page est cochée.
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = checkedOnPage > 0 && !allChecked;
    }
  }, [checkedOnPage, allChecked]);

  const fullName = (fee: FeeRow) => `${fee.student.firstName} ${fee.student.lastName}`;
  const lastMethod = (fee: FeeRow) => fee.payments[fee.payments.length - 1]?.method ?? null;
  const remainingText = (fee: FeeRow) =>
    t("finance.remainingIs").replace("{amount}", formatMRU(fee.remaining));

  return (
    <>
      <ul className="divide-y divide-border/70 md:hidden">
        {rows.map((fee) => {
          const checked = selected.has(fee.id);
          const method = lastMethod(fee);
          const parent = parentLine(fee, t);
          return (
            <li key={fee.id} className={cn("flex gap-3 px-4 py-3.5", checked && "bg-primary-50/50")}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleRow(fee.id)}
                aria-label={t("students.selectRow").replace("{name}", fullName(fee))}
                className={cn(checkboxClass, "mt-3 shrink-0")}
              />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => actions.onView(fee)}
                  className="flex w-full min-w-0 items-center gap-3 text-start"
                >
                  <StudentAvatar
                    firstName={fee.student.firstName}
                    lastName={fee.student.lastName}
                    photoUrl={fee.student.photoUrl}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-foreground">{fullName(fee)}</span>
                    {parent && <span className="block truncate text-xs text-foreground/50">{parent}</span>}
                  </span>
                </button>
                {fee.parent && (
                  <div className="ps-[3.25rem]">
                    <FamilyBadge parent={fee.parent} onClick={() => actions.onFamily(fee.parent!.id)} />
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {fee.student.className && <span className={classChip}>{fee.student.className}</span>}
                  <FeeStatusBadge status={fee.status} />
                  {method && <PaymentMethodLabel method={method} short compact />}
                </div>
                <p className="mt-2 text-sm">
                  <span className="font-semibold text-foreground" style={tabular}>
                    {formatMRU(fee.amount)}
                  </span>
                  <span className="text-foreground/50"> · {fee.label}</span>
                </p>
                {(fee.status === "PARTIAL" || fee.overdueDays > 0) && (
                  <p className="mt-0.5 text-xs">
                    {fee.status === "PARTIAL" && (
                      <span className="font-medium text-amber-700">{remainingText(fee)}</span>
                    )}
                    {fee.status === "PARTIAL" && fee.overdueDays > 0 && " · "}
                    {fee.overdueDays > 0 && (
                      <span className="text-red-600">{overdueText(fee.overdueDays, t)}</span>
                    )}
                  </p>
                )}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs text-foreground/60">
                    <FeeDate fee={fee} />
                  </span>
                  <RowButtons fee={fee} actions={actions} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/60 text-xs font-semibold uppercase tracking-wide text-foreground/50">
              <th className="w-12 px-4 py-3 text-start">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => onTogglePage(e.target.checked)}
                  aria-label={t("students.selectAll")}
                  className={checkboxClass}
                />
              </th>
              <th className="px-3 py-3 text-start">{t("finance.student")}</th>
              <th className="hidden px-3 py-3 text-start xl:table-cell">{t("students.class")}</th>
              <th className="hidden min-w-[10rem] px-3 py-3 text-start xl:table-cell">{t("finance.colFeeType")}</th>
              <th className="px-3 py-3 text-start">{t("finance.amount")}</th>
              <th className="hidden px-3 py-3 text-start min-[90rem]:table-cell">{t("finance.colDate")}</th>
              <th className="px-3 py-3 text-start">{t("finance.status")}</th>
              <th className="hidden px-3 py-3 text-start min-[90rem]:table-cell">{t("finance.method")}</th>
              <th className="px-3 py-3 text-end">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {rows.map((fee) => {
              const checked = selected.has(fee.id);
              const method = lastMethod(fee);
              const parent = parentLine(fee, t);
              return (
                <tr
                  key={fee.id}
                  className={cn(
                    "transition-colors hover:bg-surface-muted/40",
                    checked && "bg-primary-50/50 hover:bg-primary-50/70",
                  )}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleRow(fee.id)}
                      aria-label={t("students.selectRow").replace("{name}", fullName(fee))}
                      className={checkboxClass}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => actions.onView(fee)}
                      className="group flex min-w-0 items-center gap-3 text-start"
                    >
                      <StudentAvatar
                        firstName={fee.student.firstName}
                        lastName={fee.student.lastName}
                        photoUrl={fee.student.photoUrl}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-foreground transition-colors group-hover:text-primary-700">
                          {fullName(fee)}
                        </span>
                        {parent && (
                          <span className="block max-w-[14rem] truncate text-xs text-foreground/50">{parent}</span>
                        )}
                        {fee.student.className && (
                          <span className={cn(classChip, "mt-1 py-0.5 xl:hidden")}>{fee.student.className}</span>
                        )}
                      </span>
                    </button>
                    {/* Hors du bouton de la fiche : un bouton ne peut pas en contenir un autre. */}
                    {fee.parent && (
                      <div className="ps-[3.25rem]">
                        <FamilyBadge parent={fee.parent} onClick={() => actions.onFamily(fee.parent!.id)} />
                      </div>
                    )}
                  </td>
                  <td className="hidden px-3 py-3 xl:table-cell">
                    {fee.student.className ? (
                      <span className={classChip}>{fee.student.className}</span>
                    ) : (
                      <span className="text-foreground/40">—</span>
                    )}
                  </td>
                  <td className="hidden px-3 py-3 text-foreground/75 xl:table-cell">{fee.label}</td>
                  <td className="px-3 py-3">
                    <span className="block whitespace-nowrap font-semibold text-foreground" style={tabular}>
                      {formatMRU(fee.amount)}
                    </span>
                    {fee.status === "PARTIAL" && (
                      <span className="mt-0.5 block whitespace-nowrap text-xs font-medium text-amber-700">
                        {remainingText(fee)}
                      </span>
                    )}
                    <span className="mt-0.5 block max-w-[9rem] truncate text-xs text-foreground/50 xl:hidden">
                      {fee.label}
                    </span>
                  </td>
                  <td className="hidden px-3 py-3 text-foreground/70 min-[90rem]:table-cell">
                    <FeeDate fee={fee} stacked />
                  </td>
                  <td className="px-3 py-3">
                    <FeeStatusBadge status={fee.status} />
                    {fee.overdueDays > 0 && (
                      <span className="mt-1 block whitespace-nowrap text-xs text-red-600">
                        {overdueText(fee.overdueDays, t)}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-foreground/50 min-[90rem]:hidden">
                      <FeeDate fee={fee} stacked />
                    </span>
                    {/* Sous 1440 px, la colonne « Mode de paiement » est masquée
                        faute de place : le mode passe ici, sous le statut,
                        comme la date. Sans ce report, il n'apparaissait nulle
                        part sur la plupart des ordinateurs portables. */}
                    {method && (
                      <span className="mt-1.5 block min-[90rem]:hidden" data-testid="method-inline">
                        <PaymentMethodLabel method={method} short compact />
                      </span>
                    )}
                  </td>
                  <td className="hidden px-3 py-3 min-[90rem]:table-cell">
                    {method ? (
                      <PaymentMethodLabel method={method} short />
                    ) : (
                      <span className="text-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <RowButtons fee={fee} actions={actions} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
