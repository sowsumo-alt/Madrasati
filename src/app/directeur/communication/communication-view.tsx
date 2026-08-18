"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageCircle, Search, Users2, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  buildWhatsAppUrl,
  fillTemplateChecked,
  extractVariables,
  describeVariable,
  withArabic,
  schoolSignatureFr,
  schoolSignatureAr,
} from "@/lib/whatsapp";
import { formatLongDate, formatLongDateAr } from "@/lib/format";
import { TemplateDialog, type TemplateEditTarget } from "./template-dialog";
import { deleteTemplate } from "./actions";
import { useLanguage } from "@/lib/i18n/language-provider";

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
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"ALL" | "PARENT" | "TEACHER">("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  /** Variables du modèle choisi qu'on n'a pas pu renseigner : bloque l'envoi. */
  const [missingVars, setMissingVars] = useState<string[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TemplateEditTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selected = recipients.find((r) => r.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipients.filter((r) => {
      const matchesKind = kindFilter === "ALL" || r.kind === kindFilter;
      const matchesQuery =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.children.some((c) => c.name.toLowerCase().includes(q));
      return matchesKind && matchesQuery;
    });
  }, [recipients, query, kindFilter]);

  /**
   * Remplit les variables du modèle avec les données du destinataire choisi,
   * et remonte celles qui restent vides. Un montant, une moyenne ou un motif
   * manquant doit bloquer l'envoi : un parent qui reçoit « frais de scolarité
   * de  MRU » comprend surtout que l'école ne maîtrise pas ses outils.
   */
  function applyTemplate(tpl: TemplateRow, recipient: Recipient | null) {
    const today = new Date();
    const child = recipient?.children[0] ?? null;
    const base = {
      parentName: recipient?.name ?? "",
      teacherName: recipient?.name ?? "",
      studentName: child?.name ?? "",
      amount: child?.outstanding ?? "",
    };

    const fr = fillTemplateChecked(tpl.body, {
      ...base,
      date: formatLongDate(today),
      schoolName: schoolSignatureFr(schoolName),
    });
    const ar = tpl.bodyAr
      ? fillTemplateChecked(tpl.bodyAr, {
          ...base,
          date: formatLongDateAr(today),
          schoolName: schoolSignatureAr(schoolName),
        })
      : null;

    return {
      text: withArabic(fr.text, ar?.text),
      // Les deux langues portent les mêmes variables : on cumule pour ne
      // manquer aucun trou, même si un modèle arabe a été modifié à part.
      missing: [...new Set([...fr.missing, ...(ar?.missing ?? [])])],
    };
  }

  function handlePickTemplate(tpl: TemplateRow) {
    setTemplateId(tpl.id);
    const { text, missing } = applyTemplate(tpl, selected);
    setMessage(text);
    setMissingVars(missing);
  }

  function handlePickRecipient(recipient: Recipient) {
    setSelectedId(recipient.id);
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const { text, missing } = applyTemplate(tpl, recipient);
    setMessage(text);
    setMissingVars(missing);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTemplate(deleteTarget.id);
      toast.success(t("comm.templateDeleted"));
      setDeleteTarget(null);
      if (templateId === deleteTarget.id) setTemplateId(null);
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setDeleting(false);
    }
  }

  // Un modèle dont il manque une variable ne part pas, même si le texte
  // paraît complet : c'est exactement ainsi qu'un montant vide se glissait
  // jusque chez le parent.
  const blocked = missingVars.length > 0;
  const canSend = Boolean(selected && message.trim()) && !blocked;

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const usesAmount = selectedTemplate
    ? extractVariables(selectedTemplate.body).includes("amount")
    : false;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Communication</h1>
        <p className="mt-1 text-sm text-foreground/60">{t("comm.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
        {/* Destinataires */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users2 className="h-4 w-4 text-foreground/40" />
              Destinataire
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 p-4 pt-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher…"
                className="pl-9"
              />
            </div>

            <div className="flex gap-1.5">
              {(["ALL", "PARENT", "TEACHER"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    kindFilter === k
                      ? "bg-primary-700 text-white"
                      : "bg-surface-muted text-foreground/60 hover:text-foreground"
                  }`}
                >
                  {k === "ALL" ? "Tous" : k === "PARENT" ? "Parents" : "Enseignants"}
                </button>
              ))}
            </div>

            <div className="max-h-96 flex-1 overflow-y-auto rounded-lg border border-border">
              {filtered.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-foreground/40">{t("comm.noRecipient")}</p>
              ) : (
                filtered.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handlePickRecipient(r)}
                    className={`flex w-full flex-col items-start gap-0.5 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 ${
                      selectedId === r.id ? "bg-primary-50" : "hover:bg-surface-muted"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {r.name}
                      <Badge variant={r.kind === "PARENT" ? "neutral" : "success"}>
                        {r.kind === "PARENT" ? "Parent" : "Enseignant"}
                      </Badge>
                    </span>
                    <span className="text-xs text-foreground/50">
                      {r.children.length > 0
                        ? r.children.map((c) => c.name).join(", ")
                        : r.phone}
                    </span>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Message */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">{t("comm.templates")}</CardTitle>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditTarget(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Nouveau
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex flex-wrap gap-2">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className={`group flex items-center gap-1 rounded-lg border px-1 py-1 transition-colors ${
                      templateId === tpl.id
                        ? "border-primary-500 bg-primary-50"
                        : "border-border hover:bg-surface-muted"
                    }`}
                  >
                    <button
                      onClick={() => handlePickTemplate(tpl)}
                      className="px-2 py-1 text-sm text-foreground"
                    >
                      {tpl.title}
                    </button>
                    <button
                      onClick={() => {
                        setEditTarget({ id: tpl.id, title: tpl.title, body: tpl.body, bodyAr: tpl.bodyAr });
                        setDialogOpen(true);
                      }}
                      title={t("comm.editTemplate")}
                      className="flex h-6 w-6 items-center justify-center rounded text-foreground/40 hover:bg-surface-muted hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(tpl)}
                      title={t("comm.deleteTemplate")}
                      className="flex h-6 w-6 items-center justify-center rounded text-foreground/40 hover:bg-red-50 hover:text-danger"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Message
                {selected && (
                  <span className="ml-2 font-normal text-foreground/50">
                    pour {selected.name}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={7}
                placeholder={t("comm.messagePlaceholder")}
                className="w-full rounded-lg border border-border bg-surface p-3 text-sm leading-relaxed text-foreground placeholder:text-foreground/40 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />

              {!selected && (
                <p className="text-xs text-foreground/50">{t("comm.pickRecipientFirst")}</p>
              )}

              {blocked && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="text-xs text-amber-900">
                    <p className="font-medium">
                      {usesAmount && missingVars.includes("amount")
                        ? "Impossible d'envoyer ce rappel : aucun frais en attente trouvé pour cet élève."
                        : "Impossible d'envoyer ce message : une information manque."}
                    </p>
                    <p className="mt-1 text-amber-800/80">
                      Non renseigné :{" "}
                      {missingVars.map((v) => describeVariable(v)).join(", ")}. Complétez
                      la donnée manquante, ou modifiez le texte à la main ci-dessus.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                {canSend ? (
                  <a
                    href={buildWhatsAppUrl(selected!.phone, message)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-800"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Ouvrir WhatsApp
                  </a>
                ) : (
                  <Button disabled>
                    <MessageCircle className="h-4 w-4" />
                    Ouvrir WhatsApp
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editTarget={editTarget}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("comm.deleteTemplateTitle")}
        description="Le modèle sera retiré de la liste. Vos messages déjà envoyés ne sont pas affectés."
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
