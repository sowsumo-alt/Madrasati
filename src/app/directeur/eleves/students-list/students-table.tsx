"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import {
  Eye,
  FileText,
  MessageCircle,
  MoreVertical,
  Pencil,
  Phone,
  UserCheck,
  UserX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import { buildTelUrl, buildWhatsAppUrl } from "@/lib/whatsapp";
import { joinFullName } from "@/lib/student-form";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import type { StudentRow } from "../students-view";
import { StudentAvatar } from "./student-avatar";
import { FamilyBadge } from "@/components/family/family-badge";
import { STATUS_KEYS, STATUS_VARIANT } from "./student-status";

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

const checkboxClass = "h-4 w-4 cursor-pointer rounded border-border accent-primary-700";

/** Tableau d'une page d'élèves : sélection, identité, parent, classe, statut et actions. */
export function StudentsTable({
  rows,
  selected,
  onToggleRow,
  onTogglePage,
  onView,
  onEdit,
  onToggleStatus,
  onFamily,
  schoolName,
}: {
  rows: StudentRow[];
  selected: Set<string>;
  onToggleRow: (id: string) => void;
  onTogglePage: (checked: boolean) => void;
  onView: (student: StudentRow) => void;
  onEdit: (student: StudentRow) => void;
  onToggleStatus: (student: StudentRow) => void;
  /** Filtre la liste sur la famille de ce parent. */
  onFamily: (parentId: string) => void;
  schoolName: string;
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
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
            <th className="px-3 py-3 text-start">{t("students.name")}</th>
            <th className="hidden px-3 py-3 text-start lg:table-cell">{t("students.dateOfBirth")}</th>
            <th className="hidden px-3 py-3 text-start md:table-cell">{t("students.parent")}</th>
            <th className="px-3 py-3 text-start">{t("students.class")}</th>
            <th className="px-3 py-3 text-start">{t("students.status")}</th>
            <th className="px-4 py-3 text-end">{t("common.actions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {rows.map((s) => {
            const fullName = `${s.firstName} ${s.lastName}`;
            const checked = selected.has(s.id);
            const waMessage = `Bonjour, ici ${schoolName} au sujet de votre enfant ${fullName}.`;
            return (
              <tr
                key={s.id}
                className={cn(
                  "transition-colors hover:bg-surface-muted/40",
                  checked && "bg-primary-50/50 hover:bg-primary-50/70",
                )}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleRow(s.id)}
                    aria-label={t("students.selectRow").replace("{name}", fullName)}
                    className={checkboxClass}
                  />
                </td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onView(s)}
                    className="group flex min-w-0 items-center gap-3 text-start"
                  >
                    <StudentAvatar
                      firstName={s.firstName}
                      lastName={s.lastName}
                      photoUrl={s.photoUrl}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-foreground transition-colors group-hover:text-primary-700">
                        {fullName}
                      </span>
                      {s.gender && (
                        <span className="block text-xs text-foreground/50">
                          {t(`students.gender.${s.gender}` as TranslationKey)}
                        </span>
                      )}
                    </span>
                  </button>
                </td>
                <td className="hidden whitespace-nowrap px-3 py-3 text-foreground/70 lg:table-cell">
                  {s.dateOfBirth ? formatDate(s.dateOfBirth) : "—"}
                </td>
                <td className="hidden px-3 py-3 md:table-cell">
                  {s.parent ? (
                    <>
                      <span className="block max-w-[12rem] truncate text-foreground/80">
                        {joinFullName(s.parent.firstName, s.parent.lastName)}
                      </span>
                      <span className="block text-xs text-foreground/50" dir="ltr">
                        {s.parent.phone}
                      </span>
                      <FamilyBadge parent={s.parent} onClick={() => onFamily(s.parent!.id)} />
                    </>
                  ) : (
                    <span className="text-foreground/40">{t("students.noParent")}</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  {s.className ? (
                    <span className="inline-flex whitespace-nowrap rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
                      {s.className}
                    </span>
                  ) : (
                    /* Signalé, pas grisé : sans classe, l'élève n'apparaît ni à
                       l'appel ni sur un bulletin — il faut que ça se voie. */
                    <Badge variant="warning">{t("students.noClass")}</Badge>
                  )}
                </td>
                <td className="px-3 py-3">
                  <Badge variant={STATUS_VARIANT[s.status]}>
                    {STATUS_KEYS[s.status] ? t(STATUS_KEYS[s.status]) : s.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-0.5">
                    <IconButton label={t("students.view")} onClick={() => onView(s)}>
                      <Eye className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={t("common.edit")} onClick={() => onEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
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
                      <DropdownMenuContent align="end" className="min-w-[13rem]">
                        {s.parent && (
                          <>
                            <DropdownMenuItem asChild>
                              <a
                                href={buildWhatsAppUrl(s.parent.phone, waMessage)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <MessageCircle className="h-4 w-4 text-emerald-600" />
                                {t("students.contactWhatsapp")}
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={buildTelUrl(s.parent.phone)}>
                                <Phone className="h-4 w-4 text-blue-600" />
                                {t("students.callParent")}
                              </a>
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem asChild>
                          <Link href={`/directeur/bulletins/${s.id}`}>
                            <FileText className="h-4 w-4 text-foreground/60" />
                            {t("students.viewReportCard")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onToggleStatus(s)}
                          className={s.status === "ACTIVE" ? "text-danger" : "text-primary-700"}
                        >
                          {s.status === "ACTIVE" ? (
                            <>
                              <UserX className="h-4 w-4" />
                              {t("students.remove")}
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4" />
                              {t("students.reactivate")}
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
