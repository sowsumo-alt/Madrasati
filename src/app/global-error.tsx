"use client";

import { useEffect } from "react";
import { isChunkLoadError, reloadOnceAfterChunkError } from "@/lib/chunk-error";

/**
 * Dernier filet, quand l'erreur touche la mise en page racine elle-même
 * (src/app/layout.tsx). Cet écran la remplace entièrement : ni fournisseur de
 * langue ni feuille de style n'y sont garantis. D'où un texte fixe en français
 * et en arabe, et des styles écrits directement dans la page.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
    if (isChunkLoadError(error)) reloadOnceAfterChunkError();
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 16px",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f7f7f5",
          color: "#1a1a1a",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            Cette page n&apos;a pas pu s&apos;afficher.
          </h1>
          <p dir="rtl" style={{ margin: "6px 0 0", fontSize: 16 }}>
            تعذّر عرض هذه الصفحة.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: "10px 18px",
              border: 0,
              borderRadius: 8,
              background: "#0b5e38",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Recharger la page · إعادة التحميل
          </button>
        </div>
      </body>
    </html>
  );
}
