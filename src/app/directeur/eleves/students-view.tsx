"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Upload,
  MoreVertical,
  Pencil,
  Phone,
  UserX,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import {
  StudentFormDialog,
  type StudentClassOption,
  type StudentEditTarget,
} from "./student-form-dialog";
import { ImportDialog } from "./import-dialog";
import { setStudentStatus } from "./actions";
import { buildTelUrl } from "@/lib/whatsapp";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

export interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  status: string;
  classId: string | null;
  className: string | null;
  photoUrl: string | null;
  parent: { firstName: string; lastName: string; phone: string } | null;
}

const STATUS_KEYS: Record<string, TranslationKey> = {
  ACTIVE: "students.status.ACTIVE",
  INACTIVE: "students.status.INACTIVE",
  TRANSFERRED: "students.status.TRANSFERRED",
  GRADUATED: "students.status.GRADUATED",
};

const STATUS_VARIANT: Record<string, BadgeProps["variant"]> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  TRANSFERRED: "warning",
  GRADUATED: "warning",
};

const STATUS_FILTERS = ["ALL", "ACTIVE", "INACTIVE", "TRANSFERRED", "GRADUATED"] as const;

export function StudentsView({
  students,
  classes,
  schoolName,
  initialQuery = "",
  autoOpenNew = false,
}: {
  students: StudentRow[];
  classes: StudentClassOption[];
  schoolName: string;
  /** Terme envoyé par la recherche globale de l'en-tête (?q=…). */
  initialQuery?: string;
  /** Ouvre directement le formulaire d'inscription (?new=1), depuis le menu "Inscription". */
  autoOpenNew?: boolean;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StudentEditTarget | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<StudentRow | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    if (autoOpenNew) {
      setEditTarget(null);
      setFormOpen(true);
      router.replace("/directeur/eleves");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenNew]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      const matchesQuery =
        !q ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        (s.className ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [students, query, statusFilter]);

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(s: StudentRow) {
    setEditTarget({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      dateOfBirth: s.dateOfBirth ? s.dateOfBirth.slice(0, 10) : null,
      gender: s.gender,
      classId: s.classId,
      status: s.status,
      photoUrl: s.photoUrl,
      parentFirstName: s.parent?.firstName ?? "",
      parentLastName: s.parent?.lastName ?? "",
      parentPhone: s.parent?.phone ?? "",
    });
    setFormOpen(true);
  }

  async function handleConfirmToggle() {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      const nextStatus = confirmTarget.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await setStudentStatus(confirmTarget.id, nextStatus);
      toast.success(
        nextStatus === "INACTIVE" ? t("students.removed") : t("students.reactivated"),
      );
      setConfirmTarget(null);
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("students.title")}</h1>
          <p className="mt-1 text-sm text-foreground/60">{t("students.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            {t("students.importExcel")}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t("students.new")}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("students.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary-700 text-white"
                  : "bg-surface-muted text-foreground/60 hover:text-foreground"
              }`}
            >
              {s === "ALL" ? t("common.all") : t(STATUS_KEYS[s])}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-foreground/50">
            {students.length === 0 ? t("students.emptyList") : t("students.noMatch")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">{t("students.name")}</th>
                  <th className="px-5 py-3">{t("students.class")}</th>
                  <th className="px-5 py-3">{t("students.parent")}</th>
                  <th className="px-5 py-3">{t("students.status")}</th>
                  <th className="px-5 py-3 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => {
                  const waMessage = `Bonjour, ici ${schoolName} au sujet de votre enfant ${s.firstName} ${s.lastName}.`;
                  return (
                    <tr key={s.id} className="hover:bg-surface-muted/40">
                      <td className="px-5 py-3 font-medium text-foreground">
                        <span className="flex items-center gap-2.5">
                          {s.photoUrl ? (
                            <Image
                              src={s.photoUrl}
                              alt=""
                              width={240}
                              height={240}
                              unoptimized
                              className="h-8 w-8 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-700">
                              {s.firstName.charAt(0).toUpperCase()}
                            </span>
                          )}
                          {s.firstName} {s.lastName}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {s.className ?? (
                          <span className="text-foreground/40">
                            {t("students.noClass")}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {s.parent ? (
                          `${s.parent.firstName} ${s.parent.lastName}`
                        ) : (
                          <span className="text-foreground/40">
                            {t("students.noParent")}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={STATUS_VARIANT[s.status]}>
                          {STATUS_KEYS[s.status] ? t(STATUS_KEYS[s.status]) : s.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {s.parent && (
                            <>
                              <WhatsAppLink
                                phone={s.parent.phone}
                                message={waMessage}
                                title={t("students.contactWhatsapp")}
                              />
                              <a
                                href={buildTelUrl(s.parent.phone)}
                                title={t("students.callParent")}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                              >
                                <Phone className="h-4 w-4" />
                              </a>
                            </>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                aria-label={t("common.actions")}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(s)}>
                                <Pencil className="h-4 w-4" />
                                {t("common.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setConfirmTarget(s)}
                                className={
                                  s.status === "ACTIVE" ? "text-danger" : "text-primary-700"
                                }
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
        )}
      </div>

      <StudentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        classes={classes}
        editTarget={editTarget}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={
          confirmTarget?.status === "ACTIVE"
            ? t("students.deleteConfirm")
            : t("students.reactivateConfirm")
        }
        description={
          confirmTarget?.status === "ACTIVE"
            ? t("students.deleteConfirmBody")
            : t("students.reactivateBody")
        }
        confirmLabel={
          confirmTarget?.status === "ACTIVE" ? t("students.remove") : t("students.reactivate")
        }
        variant={confirmTarget?.status === "ACTIVE" ? "danger" : "primary"}
        loading={confirmLoading}
        onConfirm={handleConfirmToggle}
      />
    </div>
  );
}
