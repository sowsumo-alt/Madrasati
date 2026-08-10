import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LoginForm } from "./login-form";
import { GraduationCap } from "lucide-react";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-screen flex-1">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary-800 px-12 py-10 text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 0, transparent 45%), radial-gradient(circle at 80% 60%, white 0, transparent 40%)",
          }}
        />
        <div className="relative flex items-center gap-2 text-lg font-semibold tracking-tight">
          <GraduationCap className="h-7 w-7 text-accent-300" strokeWidth={2} />
          Madrasati
        </div>
        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            La gestion de votre école, aussi simple que WhatsApp.
          </h1>
          <p className="mt-4 text-primary-100/80 text-sm leading-relaxed">
            Élèves, notes, présences, finances et communication avec les
            parents — tout au même endroit, pensé pour les écoles
            mauritaniennes.
          </p>
        </div>
        <p className="relative text-xs text-primary-100/50">
          © {new Date().getFullYear()} Madrasati — Nouakchott, Mauritanie
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 text-primary-800 lg:hidden">
            <GraduationCap className="h-7 w-7" strokeWidth={2} />
            <span className="text-lg font-semibold tracking-tight">
              Madrasati
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
