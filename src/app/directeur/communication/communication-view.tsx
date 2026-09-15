"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessagesSquare, Plus, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  fillTemplateChecked,
  withArabic,
  schoolSignatureFr,
  schoolSignatureAr,
} from "@/lib/whatsapp";
import { formatLongDate, formatLongDateAr } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-provider";
import { TemplateDialog, type TemplateEditTarget } from "./template-dialog";
import { deleteTemplate } from "./actions";
import { RecipientsPanel, type RecipientKind } from "./message/recipients-panel";
import { TemplateGrid } from "./message/template-grid";
import { MessageComposer } from "./message/message-composer";
import { SendQueueDialog } from "./message/send-queue-dialog";
import { PreviewDialog } from "./message/preview-dialog";

export interface RecipientChild {
  name: string;
  /** Reste dû, déjà formaté et sans unité, `null` si l'élève est à jour. */
  outstanding: string | null;
}

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
   * Le directeur a retouché le texte : on cesse alors de le régénérer à
   * chaque changement de destinataire, sinon sa correction disparaissait au
   * clic suivant.
   */
  const [messageEdited, setMessageEdited] = useState(false);
  /** Variables du modèle qu'on n'a pas pu renseigner : elles bloquent l'envoi. */
  const [missingVars, setMissingVars] = useState<string[]>([]);
  /**
   * Valeurs saisies à la main pour les variables que l'application ne connaît
   * pas (le motif d'une alerte, la date d'une réunion). Sans ce champ, ces
   * modèles restaient bloqués : le message invitait à corriger le texte, mais
   * le corriger ne débloquait jamais l'envoi.
   */
  const [manualVars, setManualVars] = useState<Record<string, string>>({});

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TemplateEditTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const selected = useMemo(
    () => recipients.filter((r) => selectedIds.has(r.id)),
    [recipients, selectedIds],
  );
  const first = selected[0] ?? null;

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
   * Remplit les variables d'un modèle avec les données du destinataire, et
   * remonte celles qui restent vides. Un montant ou une moyenne manquante doit
   * bloquer l'envoi : un parent qui reçoit « frais de scolarité de  MRU »
   * comprend surtout que l'école ne maîtrise pas ses outils.
   */
  function applyTemplate(
    tpl: TemplateRow,
    recipient: Recipient | null,
    manual: Record<string, string> = {},
  ) {
    const today = new Date();
    const child = recipient?.children[0] ?? null;
    // Une saisie manuelle non vide l'emporte : c'est elle qui complète un
    // motif ou une date que l'application ne peut pas deviner.
    const base: Record<string, string> = {
      parentName: recipient?.name ?? "",
      teacherName: recipient?.name ?? "",
      studentName: child?.name ?? "",
      amount: child?.outstanding ?? "",
    };
    for (const [key, value] of Object.entries(manual)) {
      if (value.trim()) base[key] = value.trim();
    }

    const fr = fillTemplateChecked(tpl.body, {
      date: formatLongDate(today),
      ...base,
      schoolName: schoolSignatureFr(schoolName),
    });
    const ar = tpl.bodyAr
      ? fillTemplateChecked(tpl.bodyAr, {
          date: formatLongDateAr(today),
          ...base,
          schoolName: schoolSignatureAr(schoolName),
        })
      : null;

    return {
      text: withArabic(fr.text, ar?.text),
      // Les deux langues portent les mêmes variables : on cumule pour ne
      // manquer aucun trou, même si le modèle arabe a été modifié à part.
      missing: [...new Set([...fr.missing, ...(ar?.missing ?? [])])],
    };
  }

  function pickTemplate(tpl: TemplateRow) {
    setTemplateId(tpl.id);
    // Changer de modèle repart d'une page blanche : le motif saisi pour une
    // alerte n'a aucun sens dans une invitation à une réunion.
    setManualVars({});
    setMessageEdited(false);
    if (!subject.trim()) setSubject(tpl.title);
    const { text, missing } = applyTemplate(tpl, first);
    setMessage(text);
    setMissingVars(missing);
  }

  function toggleRecipient(recipient: Recipient) {
    const next = new Set(selectedIds);
    if (next.has(recipient.id)) next.delete(recipient.id);
    else next.add(recipient.id);
    setSelectedIds(next);

    const tpl = templates.find((x) => x.id === templateId);
    if (!tpl || messageEdited) return;
    // Le texte affiché est celui du premier destinataire ; les autres reçoivent
    // le leur au moment de l'envoi.
    const preview = recipients.find((r) => next.has(r.id)) ?? null;
    const { text, missing } = applyTemplate(tpl, preview, manualVars);
    setMessage(text);
    setMissingVars(missing);
  }

  /** Saisie d'une variable manquante : le message se reconstruit à chaque frappe. */
  function handleManualVar(name: string, value: string) {
    const next = { ...manualVars, [name]: value };
    setManualVars(next);
    const tpl = templates.find((x) => x.id === templateId);
    if (!tpl) return;
    const { text, missing } = applyTemplate(tpl, first, next);
    setMessage(text);
    setMissingVars(missing);
    setMessageEdited(false);
  }

  function resetComposer() {
    setTemplateId(null);
    setSubject("");
    setMessage("");
    setMessageEdited(false);
    setMissingVars([]);
    setManualVars({});
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** Message final d'un destinataire : l'objet devient la première ligne, en gras. */
  function messageFor(recipient: Recipient) {
    const tpl = templates.find((x) => x.id === templateId);
    const body = tpl && !messageEdited ? applyTemplate(tpl, recipient, manualVars).text : message;
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

  const canSend = selected.length > 0 && message.trim().length > 0 && missingVars.length === 0;

  return (
    <div className="space-y-5">
      {/* Entête illustrée de la maquette : ce que fait l'écran, et l'action principale. */}
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-surface p-5 shadow-soft sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 end-0 hidden w-1/2 bg-gradient-to-l from-primary-50/70 to-transparent lg:block"
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
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
              onMessageChange={(value) => {
                setMessage(value);
                setMessageEdited(true);
              }}
              missingVars={missingVars}
              manualVars={manualVars}
              onManualVar={handleManualVar}
              canSend={canSend}
              reachableCount={selected.filter((r) => r.phone.trim()).length}
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
        recipients={selected}
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
