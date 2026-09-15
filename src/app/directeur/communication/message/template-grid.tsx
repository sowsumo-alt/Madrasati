"use client";

import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Megaphone,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { TemplateRow } from "../communication-view";

// Icône déduite du titre : les modèles sont écrits par l'école, pas choisis
// dans une liste fermée — un mot-clé reste plus fiable qu'une clé technique.
const RULES: [RegExp, LucideIcon][] = [
  [/absence|absent/, UserX],
  [/annonce|information generale/, Megaphone],
  [/reunion|rencontre|invitation|convocation/, CalendarDays],
  [/paiement|frais|versement|recu/, CreditCard],
  [/note|bulletin|resultat|moyenne/, FileText],
  [/heure|atelier|horaire|emploi/, Clock],
  [/surveill|alerte|discipline|retard/, AlertTriangle],
];

const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function templateIcon(title: string): LucideIcon {
  const key = normalize(title);
  for (const [pattern, icon] of RULES) if (pattern.test(key)) return icon;
  return MessageSquare;
}

/** Modèles de message de l'école, en tuiles : un clic remplit le message. */
export function TemplateGrid({
  templates,
  selectedId,
  onPick,
  onCreate,
  onEdit,
  onDelete,
}: {
  templates: TemplateRow[];
  selectedId: string | null;
  onPick: (template: TemplateRow) => void;
  onCreate: () => void;
  onEdit: (template: TemplateRow) => void;
  onDelete: (template: TemplateRow) => void;
}) {
  const { t } = useLanguage();

  return (
    <section className="min-w-0 rounded-2xl border border-border/80 bg-surface p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-base font-semibold text-foreground">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <FileText className="h-4.5 w-4.5" />
          </span>
          {t("comm.templates")}
        </h2>
        <Button size="sm" variant="secondary" onClick={onCreate}>
          <Plus className="h-4 w-4" />
          {t("comm.newTemplate")}
        </Button>
      </div>

      {templates.length === 0 ? (
        <p className="py-10 text-center text-sm text-foreground/50">{t("comm.noTemplate")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 min-[88rem]:grid-cols-4 min-[100rem]:grid-cols-5">
          {templates.map((tpl) => {
            const Icon = templateIcon(tpl.title);
            const active = selectedId === tpl.id;
            return (
              <div key={tpl.id} className="group relative min-w-0">
                <button
                  type="button"
                  onClick={() => onPick(tpl)}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2.5 text-start transition-colors",
                    active
                      ? "border-primary-400 bg-primary-50 ring-1 ring-primary-300"
                      : "border-border bg-surface hover:border-primary-200 hover:bg-primary-50/50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      active ? "bg-primary-700 text-white" : "bg-surface-muted text-foreground/60",
                    )}
                  >
                    <Icon className="h-[15px] w-[15px]" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{tpl.title}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-foreground/35 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0 rtl:rotate-180" />
                </button>

                {/* Modifier et supprimer restent à portée sans encombrer la tuile. */}
                <span className="absolute end-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => onEdit(tpl)}
                    title={t("comm.editTemplate")}
                    aria-label={t("comm.editTemplate")}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-foreground/50 shadow-sm ring-1 ring-border transition-colors hover:text-primary-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(tpl)}
                    title={t("comm.deleteTemplate")}
                    aria-label={t("comm.deleteTemplate")}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-foreground/50 shadow-sm ring-1 ring-border transition-colors hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
