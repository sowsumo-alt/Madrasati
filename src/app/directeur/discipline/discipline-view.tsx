"use client";

import { useMemo, useState } from "react";
import { Search, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { IncidentFormDialog, type IncidentStudentOption } from "./incident-form-dialog";
import { deleteIncident } from "./actions";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";

export interface IncidentRow {
  id: string;
  date: string;
  type: string;
  description: string;
  sanction: string | null;
  student: { id: string; firstName: string; lastName: string; className: string | null };
}

const TYPE_KEYS: Record<string, TranslationKey> = {
  WARNING: "discipline.type.WARNING",
  REPRIMAND: "discipline.type.REPRIMAND",
  SUMMONS: "discipline.type.SUMMONS",
  SUSPENSION: "discipline.type.SUSPENSION",
  OTHER: "discipline.type.OTHER",
};

const TYPE_VARIANT: Record<string, BadgeProps["variant"]> = {
  WARNING: "warning",
  REPRIMAND: "warning",
  SUMMONS: "neutral",
  SUSPENSION: "danger",
  OTHER: "neutral",
};

export function DisciplineView({
  incidents,
  students,
}: {
  incidents: IncidentRow[];
  students: IncidentStudentOption[];
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return incidents;
    return incidents.filter((i) => {
      const name = `${i.student.firstName} ${i.student.lastName}`.toLowerCase();
      return name.includes(q);
    });
  }, [incidents, query]);

  async function handleDelete(id: string) {
    if (!window.confirm(t("discipline.confirmDelete"))) return;
    setDeletingId(id);
    try {
      await deleteIncident(id);
      toast.success(t("discipline.incidentDeleted"));
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("discipline.title")}</h1>
          <p className="mt-1 text-sm text-foreground/60">{t("discipline.subtitle")}</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("discipline.newIncident")}
        </Button>
      </div>

      <div className="relative flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("discipline.searchPlaceholder")}
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-foreground/50">
            {incidents.length === 0 ? t("discipline.emptyList") : t("discipline.noMatch")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">{t("discipline.student")}</th>
                  <th className="px-5 py-3">{t("discipline.date")}</th>
                  <th className="px-5 py-3">{t("discipline.type")}</th>
                  <th className="px-5 py-3">{t("discipline.description")}</th>
                  <th className="px-5 py-3">{t("discipline.sanction")}</th>
                  <th className="px-5 py-3 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((i) => (
                  <tr key={i.id} className="hover:bg-surface-muted/40">
                    <td className="px-5 py-3 font-medium text-foreground">
                      {i.student.firstName} {i.student.lastName}
                      {i.student.className && (
                        <span className="ml-1.5 text-xs font-normal text-foreground/40">
                          {i.student.className}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-foreground/70">{formatDate(i.date)}</td>
                    <td className="px-5 py-3">
                      <Badge variant={TYPE_VARIANT[i.type]}>{t(TYPE_KEYS[i.type])}</Badge>
                    </td>
                    <td
                      className="max-w-xs truncate px-5 py-3 text-foreground/70"
                      title={i.description}
                    >
                      {i.description}
                    </td>
                    <td className="px-5 py-3 text-foreground/70">{i.sanction ?? "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title={t("common.delete")}
                          aria-label={t("common.delete")}
                          disabled={deletingId === i.id}
                          onClick={() => handleDelete(i.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <IncidentFormDialog open={formOpen} onOpenChange={setFormOpen} students={students} />
    </div>
  );
}
