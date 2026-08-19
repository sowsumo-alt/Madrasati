"use client";

import { useState } from "react";
import { MessageCircle, Copy, Check, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import type { AccountResult } from "./actions";
import { useLanguage } from "@/lib/i18n/language-provider";

/**
 * Affiche l'identifiant et le mot de passe temporaire — une seule fois.
 * Le mot de passe n'est jamais réaffichable ensuite : il n'existe en base que
 * sous forme chiffrée. Le directeur l'envoie par WhatsApp depuis ce dialogue.
 */
export function CredentialsDialog({
  result,
  onOpenChange,
  schoolName,
}: {
  result: AccountResult | null;
  onOpenChange: (open: boolean) => void;
  schoolName: string;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  if (!result) {
    return <Dialog open={false} onOpenChange={onOpenChange}><DialogContent /></Dialog>;
  }

  const message = [
    `Bonjour ${result.personName},`,
    "",
    `Voici votre accès à Madrasati pour ${schoolName} :`,
    `Identifiant : ${result.email}`,
    `Mot de passe : ${result.tempPassword}`,
    "",
    "Il vous sera demandé de choisir votre propre mot de passe à la première connexion.",
  ].join("\n");

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Le presse-papiers peut être bloqué : les identifiants restent lisibles à l'écran. */
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary-700" />{t("credentials.title")}</DialogTitle>
          <DialogDescription>
            Notez ou envoyez ces informations maintenant :{" "}
            <strong>{t("credentials.warningBold")}</strong>. Vous pourrez
            seulement en générer un nouveau.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg bg-surface-muted p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              Identifiant
            </p>
            <p className="mt-0.5 break-all font-medium text-foreground">
              {result.email}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/40">
              Mot de passe temporaire
            </p>
            <p className="mt-0.5 text-lg font-semibold tracking-wide text-primary-800">
              {result.tempPassword}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={copyAll}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copié" : "Copier"}
          </Button>
          {result.phone && (
            <a
              href={buildWhatsAppUrl(result.phone, message)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-800"
            >
              <MessageCircle className="h-4 w-4" />{t("credentials.sendWhatsapp")}</a>
          )}
          <Button type="button" onClick={() => onOpenChange(false)}>{t("credentials.acknowledged")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
