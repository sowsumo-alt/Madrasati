import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Logo } from "@/components/brand/logo";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-primary-400 px-4 py-10">
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

      <div className="relative w-full max-w-lg rounded-2xl bg-surface p-6 shadow-2xl sm:p-10">
        <div className="flex flex-col items-center text-center">
          <Logo className="h-16 w-16" />
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-primary-800 sm:text-3xl">
            Créer mon école
          </h1>
          <p className="mt-2 text-sm text-foreground/55">
            Quelques informations et votre école est prête : matières du
            programme mauritanien, année scolaire et messages aux parents déjà
            en place.
          </p>
        </div>

        <div className="mt-6">
          <SignupForm />
        </div>

        <p className="mt-6 text-center text-sm text-foreground/55">
          Vous avez déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-primary-600 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>

      <p className="relative mt-6 text-xs text-white/70">
        © {new Date().getFullYear()} Madrasati · Tous droits réservés
      </p>
    </div>
  );
}
