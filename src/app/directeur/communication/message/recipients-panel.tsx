"use client";

import { Check, Search, Users2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { Recipient } from "../communication-view";
import { RecipientAvatar } from "./recipient-avatar";

export type RecipientKind = "ALL" | "PARENT" | "TEACHER";

/**
 * Carnet d'adresses de l'école : parents et enseignants, filtrés par nom ou
 * par enfant. Un clic coche un destinataire — plusieurs peuvent recevoir le
 * même message, chacun dans sa propre conversation WhatsApp.
 */
export function RecipientsPanel({
  recipients,
  selectedIds,
  onToggle,
  query,
  onQueryChange,
  kind,
  onKindChange,
}: {
  recipients: Recipient[];
  selectedIds: Set<string>;
  onToggle: (recipient: Recipient) => void;
  query: string;
  onQueryChange: (value: string) => void;
  kind: RecipientKind;
  onKindChange: (kind: RecipientKind) => void;
}) {
  const { t } = useLanguage();

  const label = (k: RecipientKind) =>
    k === "ALL" ? t("common.all") : k === "PARENT" ? t("comm.parents") : t("comm.teachers");

  return (
    <section className="flex min-w-0 flex-col self-start rounded-2xl border border-border/80 bg-surface shadow-soft">
      <div className="flex items-center gap-2.5 px-5 pb-3 pt-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <Users2 className="h-4.5 w-4.5" />
        </span>
        <h2 className="text-base font-semibold text-foreground">{t("comm.recipients")}</h2>
        {selectedIds.size > 0 && (
          <span className="ms-auto rounded-full bg-primary-700 px-2 py-0.5 text-xs font-semibold text-white">
            {selectedIds.size}
          </span>
        )}
      </div>

      <div className="space-y-3 px-4 pb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t("comm.searchRecipient")}
            aria-label={t("comm.searchRecipient")}
            className="ps-9"
          />
        </div>

        <div className="flex gap-1.5">
          {(["ALL", "PARENT", "TEACHER"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onKindChange(k)}
              aria-pressed={kind === k}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                kind === k
                  ? "bg-primary-700 text-white shadow-sm"
                  : "bg-surface-muted text-foreground/65 hover:bg-primary-50 hover:text-primary-800",
              )}
            >
              {label(k)}
            </button>
          ))}
        </div>

        <ul className="max-h-[24rem] space-y-1 overflow-y-auto pe-1 [scrollbar-width:thin]">
          {recipients.length === 0 && (
            <li className="px-3 py-10 text-center text-xs text-foreground/40">{t("comm.noRecipient")}</li>
          )}
          {recipients.map((r) => {
            const checked = selectedIds.has(r.id);
            const isParent = r.kind === "PARENT";
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onToggle(r)}
                  aria-pressed={checked}
                  title={r.children.length > 0 ? r.children.map((c) => c.name).join(", ") : r.phone}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors",
                    checked ? "bg-primary-50 ring-1 ring-primary-200" : "hover:bg-surface-muted/70",
                  )}
                >
                  <RecipientAvatar name={r.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{r.name}</span>
                    <span className="block truncate text-xs text-foreground/50">
                      {isParent ? t("comm.parent") : t("comm.teacher")}
                    </span>
                  </span>
                  {checked ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-700 text-white">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
                        isParent ? "bg-primary-50 text-primary-700" : "bg-blue-50 text-blue-700",
                      )}
                    >
                      {isParent ? t("comm.parent") : t("comm.teacher")}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
