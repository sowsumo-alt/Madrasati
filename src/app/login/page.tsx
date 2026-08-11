import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-primary-400 px-4 py-10">
      {/* Motifs discrets : pastilles en haut à gauche, halos diffus au fond. */}
      <div
        className="pointer-events-none absolute -left-10 -top-10 h-64 w-64 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.9) 1.5px, transparent 1.6px)",
          backgroundSize: "16px 16px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 85% 15%, white 0, transparent 35%), radial-gradient(circle at 15% 85%, white 0, transparent 40%)",
        }}
      />

      <div className="relative w-full max-w-md rounded-2xl bg-surface p-8 shadow-2xl sm:p-10">
        <div className="flex flex-col items-center text-center">
          <Logo className="h-24 w-24" />
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-primary-800">
            Madrasati
          </h1>
          <p className="mt-1 text-sm text-foreground/50">
            Gestion scolaire · Mauritanie
          </p>
          <h2 className="mt-6 text-lg font-semibold text-foreground">
            Connexion à votre compte
          </h2>
        </div>

        <div className="mt-6">
          <LoginForm />
        </div>
      </div>

      <p className="relative mt-6 text-xs text-white/70">
        © {new Date().getFullYear()} Madrasati · Tous droits réservés
      </p>
    </div>
  );
}
