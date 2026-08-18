"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Phone,
  UserX,
  UserCheck,
  KeyRound,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { WhatsAppLink } from "@/components/ui/whatsapp-link";
import {
  TeacherFormDialog,
  type TeacherEditTarget,
} from "./teacher-form-dialog";
import { setTeacherStatus } from "./actions";
import {
  createTeacherAccount,
  resetUserPassword,
  type AccountResult,
} from "@/app/directeur/comptes/actions";
import { CredentialsDialog } from "@/app/directeur/comptes/credentials-dialog";
import { buildTelUrl } from "@/lib/whatsapp";
import { formatMRU, formatDate } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-provider";

export interface TeacherRow {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  diploma: string | null;
  subjectSpecialty: string | null;
  monthlySalary: number | null;
  hireDate: string | null;
  status: string;
  /** Identifiant du compte de connexion, s'il en a un. */
  userId: string | null;
  accountEmail: string | null;
}

export function TeachersView({
  teachers,
  subjects,
  schoolName,
}: {
  teachers: TeacherRow[];
  subjects: string[];
  schoolName: string;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeacherEditTarget | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<TeacherRow | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [credentials, setCredentials] = useState<AccountResult | null>(null);
  const [accountBusyId, setAccountBusyId] = useState<string | null>(null);

  async function handleCreateAccount(teacher: TeacherRow) {
    setAccountBusyId(teacher.id);
    try {
      setCredentials(await createTeacherAccount(teacher.id));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setAccountBusyId(null);
    }
  }

  async function handleResetPassword(teacher: TeacherRow) {
    if (!teacher.userId) return;
    setAccountBusyId(teacher.id);
    try {
      setCredentials(await resetUserPassword(teacher.userId));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setAccountBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (teacher) =>
        `${teacher.firstName} ${teacher.lastName}`.toLowerCase().includes(q) ||
        (teacher.subjectSpecialty ?? "").toLowerCase().includes(q),
    );
  }, [teachers, query]);

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(teacher: TeacherRow) {
    setEditTarget({
      id: teacher.id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      phone: teacher.phone,
      email: teacher.email,
      diploma: teacher.diploma,
      subjectSpecialty: teacher.subjectSpecialty,
      monthlySalary: teacher.monthlySalary,
      hireDate: teacher.hireDate ? teacher.hireDate.slice(0, 10) : null,
      status: teacher.status,
    });
    setFormOpen(true);
  }

  async function handleConfirmToggle() {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      const nextStatus = confirmTarget.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await setTeacherStatus(confirmTarget.id, nextStatus);
      toast.success(
        nextStatus === "INACTIVE" ? "Enseignant désactivé." : "Enseignant réactivé.",
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
          <h1 className="text-xl font-semibold text-foreground">Enseignants</h1>
          <p className="mt-1 text-sm text-foreground/60">{t("teachers.subtitle")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouvel enseignant
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("teachers.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-foreground/50">
            {teachers.length === 0
              ? "Aucun enseignant pour l'instant. Ajoutez le premier."
              : "Aucun enseignant ne correspond à votre recherche."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">Nom</th>
                  <th className="px-5 py-3">{t("teachers.subject")}</th>
                  <th className="px-5 py-3">Salaire</th>
                  <th className="px-5 py-3">{t("teachers.hiredOn")}</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3">{t("teachers.access")}</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((teacher) => {
                  const waMessage = `Bonjour ${teacher.firstName}, ici ${schoolName}.`;
                  return (
                    <tr key={teacher.id} className="hover:bg-surface-muted/40">
                      <td className="px-5 py-3 font-medium text-foreground">
                        {teacher.firstName} {teacher.lastName}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {teacher.subjectSpecialty ?? (
                          <span className="text-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {teacher.monthlySalary != null ? (
                          formatMRU(teacher.monthlySalary)
                        ) : (
                          <span className="text-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {teacher.hireDate ? (
                          formatDate(teacher.hireDate)
                        ) : (
                          <span className="text-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={teacher.status === "ACTIVE" ? "success" : "neutral"}>
                          {teacher.status === "ACTIVE" ? "Actif" : "Inactif"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        {teacher.userId ? (
                          <span
                            className="text-xs text-foreground/60"
                            title={teacher.accountEmail ?? ""}
                          >
                            {teacher.accountEmail}
                          </span>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={accountBusyId === teacher.id}
                            onClick={() => handleCreateAccount(teacher)}
                          >
                            {accountBusyId === teacher.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <KeyRound className="h-3 w-3" />
                            )}
                            Créer un accès
                          </Button>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <WhatsAppLink
                            phone={teacher.phone}
                            message={waMessage}
                            title={t("teachers.contactWhatsapp")}
                          />
                          <a
                            href={buildTelUrl(teacher.phone)}
                            title="Appeler"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                aria-label="Actions"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(teacher)}>
                                <Pencil className="h-4 w-4" />
                                Modifier
                              </DropdownMenuItem>
                              {teacher.userId && (
                                <DropdownMenuItem onClick={() => handleResetPassword(teacher)}>
                                  <KeyRound className="h-4 w-4" />{t("teachers.resetPassword")}</DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => setConfirmTarget(teacher)}
                                className={
                                  teacher.status === "ACTIVE" ? "text-danger" : "text-primary-700"
                                }
                              >
                                {teacher.status === "ACTIVE" ? (
                                  <>
                                    <UserX className="h-4 w-4" />{t("teachers.deactivate")}</>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4" />{t("teachers.reactivate")}</>
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

      <TeacherFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        subjects={subjects}
        editTarget={editTarget}
      />
      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={
          confirmTarget?.status === "ACTIVE"
            ? "Désactiver cet enseignant ?"
            : "Réactiver cet enseignant ?"
        }
        description={
          confirmTarget?.status === "ACTIVE"
            ? "L'enseignant n'apparaîtra plus comme actif. Son historique est conservé."
            : "L'enseignant redevient actif."
        }
        confirmLabel={confirmTarget?.status === "ACTIVE" ? "Désactiver" : "Réactiver"}
        variant={confirmTarget?.status === "ACTIVE" ? "danger" : "primary"}
        loading={confirmLoading}
        onConfirm={handleConfirmToggle}
      />
      <CredentialsDialog
        result={credentials}
        onOpenChange={(open) => !open && setCredentials(null)}
        schoolName={schoolName}
      />
    </div>
  );
}
