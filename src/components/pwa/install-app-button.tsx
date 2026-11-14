"use client";

import { useState, useSyncExternalStore } from "react";
import { MonitorDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n/dictionaries";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  browserKind,
  getInstallState,
  getServerInstallState,
  promptInstall,
  subscribeInstallState,
  type BrowserKind,
} from "@/lib/install-prompt";

const HOW_TO: Record<BrowserKind, TranslationKey> = {
  chromium: "install.chromium",
  "safari-mac": "install.safariMac",
  ios: "install.ios",
  firefox: "install.firefox",
  other: "install.other",
};

/**
 * « Installer l'application » : Madrasati sur le bureau, dans sa propre
 * fenêtre. Chrome et Edge ouvrent leur fenêtre d'installation ; ailleurs, on
 * explique le geste. Disparaît une fois l'application installée.
 */
export function InstallAppButton({ variant = "icon" }: { variant?: "icon" | "link" }) {
  const { t } = useLanguage();
  const state = useSyncExternalStore(subscribeInstallState, getInstallState, getServerInstallState);
  const [kind, setKind] = useState<BrowserKind | null>(null);

  if (state === "installed") return null;

  async function install() {
    if (await promptInstall()) return;
    setKind(browserKind(navigator.userAgent, navigator.maxTouchPoints));
  }

  const label = t("header.installApp");
  return (
    <>
      <button
        type="button"
        onClick={install}
        title={label}
        aria-label={variant === "icon" ? label : undefined}
        data-testid="install-app"
        className={cn(
          variant === "icon"
            ? "inline-flex items-center gap-2 rounded-lg p-2 text-foreground/60 transition-colors hover:bg-surface-muted hover:text-foreground"
            : "inline-flex items-center gap-2 text-sm font-medium text-primary-700 transition-colors hover:text-primary-800",
        )}
      >
        <MonitorDown className={variant === "icon" ? "h-5 w-5" : "h-4 w-4"} />
        {variant === "link" && label}
      </button>
      <Dialog open={kind !== null} onOpenChange={(open) => !open && setKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("install.title")}</DialogTitle>
            <DialogDescription>{t("install.intro")}</DialogDescription>
          </DialogHeader>
          {kind && <p className="text-sm leading-relaxed text-foreground" data-testid="install-how-to">{t(HOW_TO[kind])}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
