"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { pageNumbers } from "@/lib/pagination";

const arrowClass =
  "flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-30";

/**
 * Pied d'une liste paginée : le résumé (« Affichage de 1 à 10 sur 28 élèves »)
 * et les numéros de page. Le résumé est rédigé par la page, qui sait ce qu'elle
 * liste.
 */
export function ListPagination({
  page,
  pageCount,
  summary,
  previousLabel,
  nextLabel,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  summary: string;
  previousLabel: string;
  nextLabel: string;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row">
      <p className="text-xs text-foreground/55" style={{ fontVariantNumeric: "tabular-nums" }}>
        {summary}
      </p>
      {pageCount > 1 && (
        <nav className="flex items-center gap-1" aria-label={summary}>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            aria-label={previousLabel}
            className={arrowClass}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </button>
          {pageNumbers(page, pageCount).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1.5 text-xs text-foreground/40">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  "h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition-colors",
                  p === page
                    ? "bg-primary-700 text-white shadow-sm"
                    : "text-foreground/65 hover:bg-surface-muted",
                )}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page === pageCount}
            aria-label={nextLabel}
            className={arrowClass}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        </nav>
      )}
    </div>
  );
}
