"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

const LINKS = [
  { href: "#modules", label: "Fonctionnalités" },
  { href: "#mauritanie", label: "Pourquoi Madrasati" },
  { href: "#questions", label: "Questions" },
];

/**
 * Barre de navigation de la page publique : transparente au-dessus du hero,
 * opaque dès que le visiteur descend. Sur mobile, un panneau plein écran
 * remplace les liens — le pouce atteint tout sans zoomer.
 */
export function MarketingNav({ demoUrl }: { demoUrl: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled || open
          ? "border-b border-border bg-surface/95 backdrop-blur"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <span
            className={cn(
              "text-lg font-bold tracking-tight transition-colors",
              scrolled || open ? "text-primary-800" : "text-white",
            )}
          >
            Madrasati
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                scrolled
                  ? "text-foreground/70 hover:bg-surface-muted hover:text-foreground"
                  : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className={cn(
              "hidden rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:block",
              scrolled
                ? "text-foreground/70 hover:text-foreground"
                : "text-white/80 hover:text-white",
            )}
          >
            Connexion
          </Link>
          <a
            href={demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-lg bg-accent-400 px-4 py-2 text-sm font-semibold text-primary-900 transition-colors hover:bg-accent-300 sm:inline-flex"
          >
            Démo gratuite
            <ArrowRight className="h-4 w-4" />
          </a>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            className={cn(
              "rounded-lg p-2 transition-colors lg:hidden",
              scrolled || open
                ? "text-foreground/70 hover:bg-surface-muted"
                : "text-white hover:bg-white/10",
            )}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-surface px-4 pb-6 pt-2 lg:hidden">
          <nav className="flex flex-col">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-border py-4 text-base font-medium text-foreground"
              >
                {l.label}
              </a>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="border-b border-border py-4 text-base font-medium text-foreground"
            >
              Connexion
            </Link>
          </nav>
          <a
            href={demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-primary-700 px-5 py-3.5 text-base font-semibold text-white"
          >
            Demander une démo gratuite
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      )}
    </header>
  );
}
