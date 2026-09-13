"use client";

import { useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-provider";

/**
 * Plein écran du navigateur — pratique sur la tablette posée au secrétariat.
 * Le bouton n'apparaît que là où le navigateur le permet (pas sur iPhone).
 */
export function FullscreenButton() {
  const { t } = useLanguage();
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    setSupported(Boolean(document.fullscreenEnabled));
    const onChange = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  if (!supported) return null;

  const label = active ? t("header.exitFullscreen") : t("header.fullscreen");

  function toggle() {
    const request = active
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    // Refus silencieux (réglage du navigateur) : rien à signaler au directeur.
    request.catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className="hidden rounded-lg p-2 text-foreground/60 transition-colors hover:bg-surface-muted hover:text-foreground sm:inline-flex"
    >
      {active ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
    </button>
  );
}
