"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessagesSquare, Plus, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { withArabic } from "@/lib/whatsapp";
import {
  manualVariables,
  personalize,
  sourceFromEdited,
  type MessageSource,
  type PersonalChild,
} from "@/lib/message-personalize";
import { useLanguage } from "@/lib/i18n/language-provider";
import { TemplateDialog, type TemplateEditTarget } from "./template-dialog";
import { deleteTemplate } from "./actions";
import { RecipientsPanel, type RecipientKind } from "./message/recipients-panel";
import { TemplateGrid } from "./message/template-grid";
import { MessageComposer } from "./message/message-composer";
import { SendQueueDialog } from "./message/send-queue-dialog";
import { PreviewDialog } from "./message/preview-dialog";

/** Un enfant du parent : son reste dû aujourd'hui et sa plus ancienne échéance. */
export type RecipientChild = PersonalChild;

export interface Recipient {
  id: string;
  name: string;
  phone: string;
  kind: "PARENT" | "TEACHER";
  /** Pour un parent : les enfants inscrits. */
  children: RecipientChild[];
}

export interface TemplateRow {
  id: string;
  key: string;
  title: string;
  body: string;
  bodyAr: string | null;
}

export function CommunicationView({
  recipients,
  templates,
  schoolName,
}: {
  recipients: Recipient[];
  templates: TemplateRow[];
  schoolName: string;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const composerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<RecipientKind>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  /**
   * Le message source, en français et en arabe, avec ses variables
   * ({parentName}, {amount}…) : chaque destinataire reçoit le sien au moment
   * de l'envoi. Null pour un texte libre, sans modèle, envoyé tel quel.
   */
  const [source, setSource] = useState<MessageSource | null>(null);
  /**
   * Valeurs saisies à la main pour les variables que l'application ne connaît
   * pas (le motif d'une alerte, l'heure d'une réunion) — jamais le nom, le
   * montant ou la date d'un parent, que Madrasati remplit pour chacun.
   */
  const [manualVars, setManualVars] = useState<Record<string, string>>({});

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TemplateEditTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const context = useMemo(() => ({ today: new Date(), schoolName }), [schoolName]);

  const selected = useMemo(
    () => recipients.filter((r) => selectedIds.has(r.id)),
    [recipients, selectedIds],
  );

  // Chaque destinataire a-t-il ce qu'il faut ? Un parent à jour ne reçoit pas
  // de rappel avec un montant vide : il est écarté, et on le dit.
  const excluded = useMemo(
    () =>
      source
        ? selected
            .map((r) => ({ recipient: r, missing: personalize(source, r, context).missingAuto }))
            .filter((x) => x.missing.length > 0)
        : [],
    [source, selected, context],
  );
  const sendable = useMemo(
    () => selected.filter((r) => !excluded.some((x) => x.recipient.id === r.id)),
    [selected, excluded],
  );
  const first = leadOf(source, selectedIds);

  const manualFields = source ? manualVariables(source) : [];
  const missingManual = manualFields.filter((name) => !manualVars[name]?.trim());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipients.filter((r) => {
      const matchesKind = kindFilter === "ALL" || r.kind === kindFilter;
      const matchesQuery =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.children.some((c) => c.name.toLowerCase().includes(q));
      return matchesKind && matchesQuery;
    });
  }, [recipients, query, kindFilter]);

  /**
   * Le destinataire dont le message s'affiche : le premier qui le recevra
   * vraiment (un parent à jour n'a pas de montant à montrer).
   */
  function leadOf(src: MessageSource | null, ids: Set<string>): Recipient | null {
    const chosen = recipients.filter((r) => ids.has(r.id));
    if (!src) return chosen[0] ?? null;
    return chosen.find((r) => personalize(src, r, context).missingAuto.length === 0) ?? chosen[0] ?? null;
  }

  /** Le texte affiché : le message du premier destinataire, ou le modèle brut. */
  function shownText(src: MessageSource, recipient: Recipient | null, manual: Record<string, string>) {
    if (!recipient) return withArabic(src.fr, src.ar);
    return personalize(src, recipient, context, manual).text;
  }

  function pickTemplate(tpl: TemplateRow) {
    setTemplateId(tpl.id);
    // Changer de modèle repart d'une page blanche : le motif saisi pour une
    // alerte n'a aucun sens dans une invitation à une réunion.
    setManualVars({});
    if (!subject.trim()) setSubject(tpl.title);
    const src = { fr: tpl.body, ar: tpl.bodyAr };
    setSource(src);
    setMessage(shownText(src, leadOf(src, selectedIds), {}));
  }

  function toggleRecipient(recipient: Recipient) {
    const next = new Set(selectedIds);
    if (next.has(recipient.id)) next.delete(recipient.id);
    else next.add(recipient.id);
    setSelectedIds(next);
    if (!source) return;
    // Le texte affiché suit le premier destinataire ; chacun recevra le sien.
    setMessage(shownText(source, leadOf(source, next), manualVars));
  }

  /** Retouche du texte : elle vaut pour tous, chacun garde ses propres valeurs. */
  function handleMessageChange(value: string) {
    setMessage(value);
    if (!source) return;
    if (first) setSource(sourceFromEdited(value, first, context));
    else {
      const [fr, ...ar] = value.split("\n————————\n");
      setSource({ fr, ar: ar.length > 0 ? ar.join("\n————————\n") : null });
    }
  }

  /** Saisie d'une variable que Madrasati ne connaît pas (motif, heure…). */
  function handleManualVar(name: string, value: string) {
    const next = { ...manualVars, [name]: value };
    setManualVars(next);
    if (source) setMessage(shownText(source, first, next));
  }

  function resetComposer() {
    setTemplateId(null);
    setSubject("");
    setMessage("");
    setSource(null);
    setManualVars({});
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** Message final d'un destinataire : l'objet devient la première ligne, en gras. */
  function messageFor(recipient: Recipient) {
    const body = source ? personalize(source, recipient, context, manualVars).text : message;
    const title = subject.trim();
    return title ? `*${title}*\n\n${body}` : body;
  }

  async function handleDeleteTemplate() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTemplate(deleteTarget.id);
      toast.success(t("comm.templateDeleted"));
      if (templateId === deleteTarget.id) setTemplateId(null);
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setDeleting(false);
    }
  }

  const canSend = sendable.length > 0 && message.trim().length > 0 && missingManual.length === 0;

  return (
    <div className="space-y-5">
      {/* Entête illustrée de la maquette : ce que fait l'écran, et l'action principale. */}
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-5 shadow-soft sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 end-0 hidden w-1/2 bg-gradient-to-l from-primary-50/70 to-transparent lg:block rtl:bg-gradient-to-r"
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
              <MessagesSquare className="h-7 w-7" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("comm.title")}</h1>
              <p className="mt-1 text-sm text-foreground/60">{t("comm.subtitle")}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <span aria-hidden className="relative hidden h-20 w-36 xl:block">
              <Sparkles className="absolute start-0 top-2 h-4 w-4 text-accent-400" />
              <Send className="absolute start-9 top-3 h-14 w-14 -rotate-12 fill-primary-100 text-primary-700" strokeWidth={1.25} />
              <Sparkles className="absolute end-1 top-0 h-3.5 w-3.5 text-accent-300" />
              <Sparkles className="absolute end-6 bottom-1 h-3 w-3 text-primary-300" />
            </span>
            <Button className="shrink-0 shadow-sm" onClick={resetComposer}>
              <Plus className="h-4 w-4" />
              {t("comm.newMessage")}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,19.5rem)_minmax(0,1fr)]">
        <RecipientsPanel
          recipients={filtered}
          selectedIds={selectedIds}
          onToggle={toggleRecipient}
          query={query}
          onQueryChange={setQuery}
          kind={kindFilter}
          onKindChange={setKindFilter}
        />

        <div className="min-w-0 space-y-5">
          <TemplateGrid
            templates={templates}
            selectedId={templateId}
            onPick={pickTemplate}
            onCreate={() => {
              setEditTarget(null);
              setTemplateDialogOpen(true);
            }}
            onEdit={(tpl) => {
              setEditTarget({ id: tpl.id, title: tpl.title, body: tpl.body, bodyAr: tpl.bodyAr });
              setTemplateDialogOpen(true);
            }}
            onDelete={setDeleteTarget}
          />

          <div ref={composerRef}>
            <MessageComposer
              recipients={recipients}
              selectedIds={selectedIds}
              onToggleRecipient={toggleRecipient}
              subject={subject}
              onSubjectChange={setSubject}
              message={message}
              onMessageChange={handleMessageChange}
              manualFields={manualFields}
              missingManual={missingManual}
              excluded={excluded.map((x) => x.recipient.name)}
              leadName={first?.name ?? null}
              manualVars={manualVars}
              onManualVar={handleManualVar}
              canSend={canSend}
              reachableCount={sendable.filter((r) => r.phone.trim()).length}
              onPreview={() => setPreviewOpen(true)}
              onSend={() => setQueueOpen(true)}
            />
          </div>
        </div>
      </div>

      <TemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        editTarget={editTarget}
      />
      <SendQueueDialog
        open={queueOpen}
        onOpenChange={setQueueOpen}
        recipients={sendable}
        messageFor={messageFor}
      />
      <PreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        text={first ? messageFor(first) : message}
        recipientName={first?.name ?? null}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("comm.deleteTemplateTitle")}
        description={t("comm.deleteTemplateHint")}
        confirmLabel={t("comm.deleteTemplate")}
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteTemplate}
      />
    </div>
  );
}
