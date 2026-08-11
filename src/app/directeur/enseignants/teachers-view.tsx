"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Plus,
  MoreVertical,
  Pencil,
  MessageCircle,
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
import { buildWhatsAppUrl, buildTelUrl } from "@/lib/whatsapp";
import { formatMRU, formatDate } from "@/lib/format";

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
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TeacherEditTarget | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<TeacherRow | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [credentials, setCredentials] = useState<AccountResult | null>(null);
  const [accountBusyId, setAccountBusyId] = useState<string | null>(null);

  async function handleCreateAccount(t: TeacherRow) {
    setAccountBusyId(t.id);
    try {
      setCredentials(await createTeacherAccount(t.id));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setAccountBusyId(null);
    }
  }

  async function handleResetPassword(t: TeacherRow) {
    if (!t.userId) return;
    setAccountBusyId(t.id);
    try {
      setCredentials(await resetUserPassword(t.userId));
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setAccountBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) =>
        `${t.firstName} ${t.lastName}`.toLowerCase().includes(q) ||
        (t.subjectSpecialty ?? "").toLowerCase().includes(q),
    );
  }, [teachers, query]);

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(t: TeacherRow) {
    setEditTarget({
      id: t.id,
      firstName: t.firstName,
      lastName: t.lastName,
      phone: t.phone,
      email: t.email,
      diploma: t.diploma,
      subjectSpecialty: t.subjectSpecialty,
      monthlySalary: t.monthlySalary,
      hireDate: t.hireDate ? t.hireDate.slice(0, 10) : null,
      status: t.status,
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
      toast.error("Une erreur est survenue.");
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Enseignants</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Gérez le personnel enseignant de l&apos;école.
          </p>
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
          placeholder="Rechercher un enseignant…"
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
                  <th className="px-5 py-3">Matière</th>
                  <th className="px-5 py-3">Salaire</th>
                  <th className="px-5 py-3">Embauché le</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3">Accès</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((t) => {
                  const waMessage = `Bonjour ${t.firstName}, ici ${schoolName}.`;
                  return (
                    <tr key={t.id} className="hover:bg-surface-muted/40">
                      <td className="px-5 py-3 font-medium text-foreground">
                        {t.firstName} {t.lastName}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {t.subjectSpecialty ?? (
                          <span className="text-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {t.monthlySalary != null ? (
                          formatMRU(t.monthlySalary)
                        ) : (
                          <span className="text-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {t.hireDate ? (
                          formatDate(t.hireDate)
                        ) : (
                          <span className="text-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={t.status === "ACTIVE" ? "success" : "neutral"}>
                          {t.status === "ACTIVE" ? "Actif" : "Inactif"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        {t.userId ? (
                          <span
                            className="text-xs text-foreground/60"
                            title={t.accountEmail ?? ""}
                          >
                            {t.accountEmail}
                          </span>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={accountBusyId === t.id}
                            onClick={() => handleCreateAccount(t)}
                          >
                            {accountBusyId === t.id ? (
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
                          <a
                            href={buildWhatsAppUrl(t.phone, waMessage)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Contacter sur WhatsApp"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-700 transition-colors hover:bg-primary-50"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                          <a
                            href={buildTelUrl(t.phone)}
                            title="Appeler"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(t)}>
                                <Pencil className="h-4 w-4" />
                                Modifier
                              </DropdownMenuItem>
                              {t.userId && (
                                <DropdownMenuItem onClick={() => handleResetPassword(t)}>
                                  <KeyRound className="h-4 w-4" />
                                  Réinitialiser le mot de passe
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => setConfirmTarget(t)}
                                className={
                                  t.status === "ACTIVE" ? "text-danger" : "text-primary-700"
                                }
                              >
                                {t.status === "ACTIVE" ? (
                                  <>
                                    <UserX className="h-4 w-4" />
                                    Désactiver
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4" />
                                    Réactiver
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
