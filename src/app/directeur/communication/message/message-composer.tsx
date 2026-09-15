"use client";

import { useRef } from "react";
import {
  AlertTriangle,
  Bold,
  Check,
  ChevronDown,
  Eye,
  Italic,
  Lightbulb,
  Link2,
  List,
  ListOrdered,
  MessageSquarePlus,
  Paperclip,
  Send,
  Strikethrough,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WhatsAppIcon } from "@/components/brand/whatsapp-icon";
import { describeVariable } from "@/lib/whatsapp";
import { useLanguage } from "@/lib/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { Recipient } from "../communication-view";

const SUBJECT_MAX = 100;

/** Bouton de la barre de mise en forme. */
function ToolButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      // Sans cela, le clic vole le focus au texte et la sélection est perdue
      // avant même que la mise en forme ne s'applique.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface hover:text-primary-700"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/**
 * Rédaction du message. La mise en forme écrit la syntaxe de WhatsApp
 * (*gras*, _italique_, ~barré~) : ce qui s'affiche ici est exactement ce que
 * le parent recevra, sans conversion hasardeuse au moment de l'envoi.
 */
export function MessageComposer({
  recipients,
  selectedIds,
  onToggleRecipient,
  subject,
  onSubjectChange,
  message,
  onMessageChange,
  missingVars,
  manualVars,
  onManualVar,
  canSend,
  reachableCount,
  onPreview,
  onSend,
}: {
  recipients: Recipient[];
  selectedIds: Set<string>;
  onToggleRecipient: (recipient: Recipient) => void;
  subject: string;
  onSubjectChange: (value: string) => void;
  message: string;
  onMessageChange: (value: string) => void;
  /** Variables du modèle qu'on n'a pas pu renseigner : elles bloquent l'envoi. */
  missingVars: string[];
  manualVars: Record<string, string>;
  onManualVar: (name: string, value: string) => void;
  canSend: boolean;
  reachableCount: number;
  onPreview: () => void;
  onSend: () => void;
}) {
  const { t } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selected = recipients.filter((r) => selectedIds.has(r.id));

  /** Remet le curseur là où on l'attend après une insertion. */
  function applyToText(next: string, start: number, end: number) {
    onMessageChange(next);
    requestAnimationFrame(() => {
      const field = textareaRef.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(start, end);
    });
  }

  function wrap(marker: string, sample: string) {
    const field = textareaRef.current;
    if (!field) return;
    const { selectionStart: from, selectionEnd: to, value } = field;
    const chosen = value.slice(from, to) || sample;
    const next = `${value.slice(0, from)}${marker}${chosen}${marker}${value.slice(to)}`;
    applyToText(next, from + marker.length, from + marker.length + chosen.length);
  }

  function prefixLines(prefix: (index: number) => string) {
    const field = textareaRef.current;
    if (!field) return;
    const { selectionStart: from, selectionEnd: to, value } = field;
    const lineStart = value.lastIndexOf("\n", Math.max(0, from - 1)) + 1;
    const nextBreak = value.indexOf("\n", to);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const listed = value
      .slice(lineStart, lineEnd)
      .split("\n")
      // Repasser sur une liste la renumérote au lieu de l'empiler.
      .map((line, i) => `${prefix(i)}${line.replace(/^(•|\d+\.)\s*/, "")}`)
      .join("\n");
    const next = `${value.slice(0, lineStart)}${listed}${value.slice(lineEnd)}`;
    applyToText(next, lineStart, lineStart + listed.length);
  }

  return (
    <section className="min-w-0 rounded-2xl border border-border/80 bg-surface p-5 shadow-soft">
      <h2 className="mb-4 flex items-center gap-2.5 text-base font-semibold text-foreground">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <MessageSquarePlus className="h-[18px] w-[18px]" />
        </span>
        {t("comm.newMessage")}
      </h2>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="comm-recipients">{t("comm.recipientsField")}</Label>
            <div className="flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5">
              {selected.map((r) => (
                <span
                  key={r.id}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-50 py-1 pe-1 ps-2.5 text-xs font-medium text-primary-800"
                >
                  <span className="truncate">{r.name}</span>
                  <button
                    type="button"
                    onClick={() => onToggleRecipient(r)}
                    aria-label={t("comm.removeRecipient").replace("{name}", r.name)}
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-primary-700/70 transition-colors hover:bg-primary-100 hover:text-primary-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    id="comm-recipients"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-start text-sm text-foreground/45 transition-colors hover:text-foreground/70"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {selected.length === 0 ? t("comm.recipientsPlaceholder") : t("comm.addRecipient")}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-foreground/40" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 w-[18rem] overflow-y-auto">
                  {recipients.length === 0 && (
                    <p className="px-2.5 py-3 text-sm text-foreground/50">{t("comm.noRecipient")}</p>
                  )}
                  {recipients.map((r) => (
                    <DropdownMenuItem
                      key={r.id}
                      onSelect={(e) => {
                        // Le menu reste ouvert : on coche souvent plusieurs parents d'affilée.
                        e.preventDefault();
                        onToggleRecipient(r);
                      }}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          selectedIds.has(r.id)
                            ? "border-primary-700 bg-primary-700 text-white"
                            : "border-border",
                        )}
                      >
                        {selectedIds.has(r.id) && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                      <span className="shrink-0 text-xs text-foreground/45">
                        {r.kind === "PARENT" ? t("comm.parent") : t("comm.teacher")}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comm-subject">{t("comm.subject")}</Label>
            <Input
              id="comm-subject"
              value={subject}
              maxLength={SUBJECT_MAX}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder={t("comm.subjectPlaceholder")}
            />
            <p className="text-end text-xs text-foreground/45" style={{ fontVariantNumeric: "tabular-nums" }}>
              {subject.length}/{SUBJECT_MAX}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comm-body">{t("comm.content")}</Label>
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface-muted/60 px-1.5 py-1">
                <ToolButton icon={Bold} label={t("comm.bold")} onClick={() => wrap("*", t("comm.boldSample"))} />
                <ToolButton icon={Italic} label={t("comm.italic")} onClick={() => wrap("_", t("comm.italicSample"))} />
                <ToolButton
                  icon={Strikethrough}
                  label={t("comm.strike")}
                  onClick={() => wrap("~", t("comm.strikeSample"))}
                />
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                <ToolButton icon={Link2} label={t("comm.link")} onClick={() => wrap("", "https://")} />
                <ToolButton icon={List} label={t("comm.bulletList")} onClick={() => prefixLines(() => "• ")} />
                <ToolButton
                  icon={ListOrdered}
                  label={t("comm.numberedList")}
                  onClick={() => prefixLines((i) => `${i + 1}. `)}
                />
              </div>
              <textarea
                id="comm-body"
                ref={textareaRef}
                value={message}
                onChange={(e) => onMessageChange(e.target.value)}
                rows={5}
                placeholder={t("comm.contentPlaceholder")}
                className="w-full resize-y bg-surface p-3 text-sm leading-relaxed text-foreground placeholder:text-foreground/40 focus:outline-none"
              />
            </div>
          </div>

          {missingVars.length > 0 && (
            <div className="space-y-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="text-xs text-amber-900">
                  <p className="font-medium">{t("comm.missingTitle")}</p>
                  <p className="mt-1 text-amber-800/80">
                    {t("comm.missingHint").replace(
                      "{fields}",
                      missingVars.map((v) => describeVariable(v)).join(", "),
                    )}
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {missingVars.map((name) => (
                  <label key={name} className="block text-xs">
                    <span className="mb-1 block font-medium capitalize text-amber-900">
                      {describeVariable(name)}
                    </span>
                    <Input
                      value={manualVars[name] ?? ""}
                      onChange={(e) => onManualVar(name, e.target.value)}
                      placeholder={describeVariable(name)}
                      className="h-9 bg-surface text-sm"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="flex h-fit flex-col items-center rounded-2xl border border-primary-100 bg-primary-50/50 p-5 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-emerald-600 shadow-sm">
            <WhatsAppIcon className="h-7 w-7" />
          </span>
          <p className="mt-3 text-base font-semibold text-primary-900">{t("comm.sendOnWhatsApp")}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-foreground/60">{t("comm.whatsappHint")}</p>
          <Button variant="secondary" className="mt-4 w-full border-primary-300 text-primary-800" onClick={onSend} disabled={!canSend}>
            <Send className="h-4 w-4" />
            {t("comm.sendNow")}
          </Button>
          <p className="mt-2 text-xs text-foreground/50">
            {t("comm.reachableCount").replace("{n}", String(reachableCount))}
          </p>
        </aside>
      </div>

      <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-xs text-amber-900">
          <span className="font-semibold">{t("comm.tipTitle")} :</span> {t("comm.tip")}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {/* Un lien wa.me ne peut pas porter de pièce jointe : annoncé, pas simulé. */}
        <Button variant="secondary" disabled title={t("comm.attachSoon")}>
          <Paperclip className="h-4 w-4" />
          {t("comm.attachFile")}
          <span className="ms-1 rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-semibold text-accent-700">
            {t("nav.soon")}
          </span>
        </Button>
        <Button variant="secondary" onClick={onPreview} disabled={!message.trim()}>
          <Eye className="h-4 w-4" />
          {t("comm.preview")}
        </Button>
        <Button onClick={onSend} disabled={!canSend}>
          <Send className="h-4 w-4" />
          {t("comm.send")}
        </Button>
      </div>
    </section>
  );
}
