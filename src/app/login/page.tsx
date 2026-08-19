import { redirect } from "next/navigation";
import { Clock, Languages, MessageCircle, ShieldCheck, Wifi } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { Logo } from "@/components/brand/logo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { RotatingWords } from "@/components/ui/rotating-words";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { CONTACT_PHONE, DEMO_MESSAGE } from "@/lib/contact";
import { LoginForm } from "./login-form";

const TRUST = [
  { icon: Clock, label: "Installée en une journée" },
  { icon: ShieldCheck, label: "Sans engagement" },
  { icon: Wifi, label: "Fonctionne en 3G" },
  { icon: Languages, label: "Français & arabe" },
];

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const demoUrl = buildWhatsAppUrl(CONTACT_PHONE, DEMO_MESSAGE);

  return (
    <div className="flex min-h-screen">
      {/* Volet de présentation — masqué sur mobile, où l'écran doit aller
          droit au formulaire plutôt que de faire défiler un argumentaire. */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary-900 px-12 py-10 text-white lg:flex lg:w-1/2">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            background:
              "radial-gradient(45rem 25rem at 85% -5%, #d1a542 0%, transparent 60%), radial-gradient(40rem 30rem at 5% 100%, #178a5c 0%, transparent 65%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative flex items-center gap-2.5">
          <Logo className="h-10 w-10" />
          <span className="text-lg font-semibold tracking-tight">Madrasati</span>
        </div>

        <div className="relative max-w-lg">
          <h1 className="animate-fade-up text-4xl font-bold leading-[1.15] tracking-tight xl:text-5xl">
            Toute votre école dans{" "}
            <RotatingWords
              words={["une seule application", "un seul écran", "votre téléphone"]}
              className="text-accent-300"
            />
          </h1>

          <p
            className="animate-fade-up mt-6 text-base leading-relaxed text-white/70"
            style={{ animationDelay: "120ms" }}
          >
            Madrasati remplace les cahiers, les fichiers Excel et les groupes
            WhatsApp désordonnés. Élèves, notes, présences, argent et
            communication avec les parents — au même endroit.
          </p>

          <ul
            className="animate-fade-up mt-8 flex flex-wrap gap-x-5 gap-y-2.5"
            style={{ animationDelay: "220ms" }}
          >
            {TRUST.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2 text-sm text-white/60">
                <Icon className="h-4 w-4 text-accent-300" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between gap-4 text-xs text-white/40">
          <p>© {new Date().getFullYear()} Madrasati — Nouakchott, Mauritanie</p>
          <a
            href={demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-white/60 transition-colors hover:text-accent-300"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Demander une démo
          </a>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        {/* Le sélecteur de langue n'existait que dans l'espace connecté : un
            enseignant arabophone arrivait donc sur un écran de connexion qu'il
            ne pouvait ni lire ni changer. */}
        <div className="absolute right-4 top-4">
          <LanguageToggle />
        </div>

        <div className="w-full max-w-sm">
          {/* Le volet de gauche disparaît sous lg : la marque doit alors
              réapparaître ici, sinon l'écran de connexion n'est plus identifié. */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Logo className="h-20 w-20" />
            <span className="mt-2 text-2xl font-bold tracking-tight text-primary-800">
              Madrasati
            </span>
            <span className="mt-1 text-sm text-foreground/50">
              Gestion scolaire · Mauritanie
            </span>
          </div>

          <h2 className="text-xl font-semibold text-foreground">Connexion</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Entrez vos identifiants pour accéder à votre espace.
          </p>

          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
