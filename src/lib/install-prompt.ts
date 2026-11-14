/**
 * Installer Madrasati comme une application (ordinateur, téléphone) : Chrome
 * et Edge proposent l'installation par l'événement « beforeinstallprompt »,
 * qu'on garde pour l'offrir au clic sur notre propre bouton. Safari et
 * Firefox ne l'envoient jamais : on explique alors le geste à faire.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState = "unavailable" | "ready" | "installed";

const INSTALLED_KEY = "madrasati:app-installee";

let deferred: BeforeInstallPromptEvent | null = null;
let state: InstallState = "unavailable";
let started = false;
const listeners = new Set<() => void>();

function setState(next: InstallState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function rememberInstalled() {
  try {
    localStorage.setItem(INSTALLED_KEY, "1");
  } catch {
    // Stockage refusé (navigation privée) : le bouton reviendra, sans gêne.
  }
}

function installedBefore() {
  try {
    return localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Ouverte depuis l'application installée (fenêtre à part, sans barre d'adresse). */
function runsAsApp() {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

/** À appeler une fois, le plus tôt possible : l'événement n'est envoyé qu'une fois par page. */
export function startInstallPromptCapture() {
  if (started || typeof window === "undefined") return;
  started = true;
  // Prévenir les boutons déjà affichés : ils ont lu l'état avant cet appel.
  if (runsAsApp() || installedBefore()) setState("installed");
  window.addEventListener("beforeinstallprompt", (event) => {
    // Pas de bandeau automatique : l'installation part de notre bouton.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    if (!runsAsApp()) setState("ready");
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    rememberInstalled();
    setState("installed");
  });
}

export function subscribeInstallState(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getInstallState = () => state;
export const getServerInstallState = (): InstallState => "unavailable";

/** Ouvre la fenêtre d'installation du navigateur ; false s'il n'en propose pas. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === "accepted") {
    rememberInstalled();
    setState("installed");
  } else {
    setState("unavailable");
  }
  return true;
}

export type BrowserKind = "chromium" | "safari-mac" | "ios" | "firefox" | "other";

/** Le navigateur, pour expliquer le bon geste quand il n'offre pas l'installation lui-même. */
export function browserKind(userAgent: string, touchPoints = 0): BrowserKind {
  const ua = userAgent.toLowerCase();
  // L'iPad se présente comme un Mac : seul l'écran tactile le trahit.
  if (/iphone|ipad|ipod/.test(ua) || (ua.includes("macintosh") && touchPoints > 1)) return "ios";
  if (ua.includes("firefox") || ua.includes("fxios")) return "firefox";
  if (/edg\/|chrome\/|crios|opr\//.test(ua)) return "chromium";
  if (ua.includes("safari") && ua.includes("macintosh")) return "safari-mac";
  return "other";
}
