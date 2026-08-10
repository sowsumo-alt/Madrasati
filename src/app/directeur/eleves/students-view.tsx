"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Upload,
  MoreVertical,
  Pencil,
  MessageCircle,
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
import {
  StudentFormDialog,
  type StudentClassOption,
  type StudentEditTarget,
} from "./student-form-dialog";
import { ImportDialog } from "./import-dialog";
import { setStudentStatus } from "./actions";
import { buildWhatsAppUrl, buildTelUrl } from "@/lib/whatsapp";
import { useRouter } from "next/navigation";

export interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  status: string;
  classId: string | null;
  className: string | null;
  parent: { firstName: string; lastName: string; phone: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  TRANSFERRED: "Transféré",
  GRADUATED: "Diplômé",
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
}: {
  students: StudentRow[];
  classes: StudentClassOption[];
  schoolName: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StudentEditTarget | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<StudentRow | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

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
        nextStatus === "INACTIVE"
          ? "Élève retiré de l'école."
          : "Élève réactivé.",
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
          <h1 className="text-xl font-semibold text-foreground">Élèves</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Gérez le dossier de chaque élève de l&apos;école.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Importer Excel
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouvel élève
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un élève ou une classe…"
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
              {s === "ALL" ? "Tous" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-foreground/50">
            {students.length === 0
              ? "Aucun élève pour l'instant. Ajoutez votre premier élève."
              : "Aucun élève ne correspond à votre recherche."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">Nom</th>
                  <th className="px-5 py-3">Classe</th>
                  <th className="px-5 py-3">Parent</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => {
                  const waMessage = `Bonjour, ici ${schoolName} au sujet de votre enfant ${s.firstName} ${s.lastName}.`;
                  return (
                    <tr key={s.id} className="hover:bg-surface-muted/40">
                      <td className="px-5 py-3 font-medium text-foreground">
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {s.className ?? (
                          <span className="text-foreground/40">Sans classe</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">
                        {s.parent ? (
                          `${s.parent.firstName} ${s.parent.lastName}`
                        ) : (
                          <span className="text-foreground/40">Aucun parent lié</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={STATUS_VARIANT[s.status]}>
                          {STATUS_LABELS[s.status] ?? s.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {s.parent && (
                            <>
                              <a
                                href={buildWhatsAppUrl(s.parent.phone, waMessage)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Contacter sur WhatsApp"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-700 transition-colors hover:bg-primary-50"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </a>
                              <a
                                href={buildTelUrl(s.parent.phone)}
                                title="Appeler le parent"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                              >
                                <Phone className="h-4 w-4" />
                              </a>
                            </>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(s)}>
                                <Pencil className="h-4 w-4" />
                                Modifier
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
                                    Retirer
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
            ? "Retirer cet élève de l'école ?"
            : "Réactiver cet élève ?"
        }
        description={
          confirmTarget?.status === "ACTIVE"
            ? "L'élève sera marqué comme inactif. Son historique (notes, présences, paiements) sera conservé."
            : "L'élève redeviendra actif dans l'école."
        }
        confirmLabel={confirmTarget?.status === "ACTIVE" ? "Retirer" : "Réactiver"}
        variant={confirmTarget?.status === "ACTIVE" ? "danger" : "primary"}
        loading={confirmLoading}
        onConfirm={handleConfirmToggle}
      />
    </div>
  );
}
