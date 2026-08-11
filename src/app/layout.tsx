import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import { getLocale, isRtlLocale } from "@/lib/i18n/server";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Madrasati — Gestion scolaire",
  description:
    "Madrasati remplace les cahiers, les fichiers Excel et WhatsApp désorganisé par une seule application pour gérer votre école.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // La langue est posée dès le rendu serveur : la page arrive déjà dans le bon
  // sens de lecture, sans clignotement de droite à gauche au chargement.
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      dir={isRtlLocale(locale) ? "rtl" : "ltr"}
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers initialLocale={locale}>{children}</Providers>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
